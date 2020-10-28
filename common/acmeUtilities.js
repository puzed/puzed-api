const fs = require('fs');
const tls = require('tls');

const Keypairs = require('@root/keypairs');
const ACME = require('@root/acme');
const CSR = require('@root/csr');
const PEM = require('@root/pem');
const isIp = require('is-ip');
const memoizee = require('memoizee');

const hint = require('hinton');
const pkg = require('../package.json');
const packageAgent = 'test-' + pkg.name + '/' + pkg.version;

function getCertificateFromDb (db, domain, filter) {
  const options = {
    query: {
      domain: { $custom: ["$1 LIKE json_extract(data, '$.domain')", domain] },
      ...filter
    },
    order: 'desc(dateCreated)',
    limit: 1
  };
  return db.getOne('certificates', options);
}

const getCertificate = async function (scope, options, servername) {
  const { settings, db } = scope;

  if (servername === 'localhost') {
    return tls.createSecureContext(options.defaultCertificates);
  }

  let certificates = options.defaultCertificates;
  if (await options.isAllowedDomain(servername)) {
    if (settings.acmeDirectoryUrl && settings.acmeDirectoryUrl !== 'none') {
      try {
        certificates = await getCertificateForDomain({ settings, db }, servername);
      } catch (error) {
        console.log(error);
      }
    }
  } else {
    console.log('domain', servername, 'is not allowed a certificate');
  }

  return tls.createSecureContext(certificates || options.defaultCertificates);
};

const getCachedCertificate = memoizee(getCertificate, { maxAge: 60000 });

async function createAcmeAccount (acme, email) {
  const accountKeypair = await Keypairs.generate({ kty: 'EC', format: 'jwk' });
  const accountKey = accountKeypair.private;

  console.info('registering new ACME account...');

  const account = await acme.accounts.create({
    subscriberEmail: email,
    agreeToTerms: true,
    accountKey
  });

  const acmeAccountPem = await Keypairs.export({ jwk: accountKey });
  await fs.promises.writeFile('./config/acme-account.pem', acmeAccountPem, 'ascii');

  console.info('created account with id', account.key.kid);
}

async function getAcmeAccount (acme, email) {
  try {
    await fs.promises.readFile('./config/acme-account.pem', 'ascii');
  } catch (error) {
    if (error.code === 'ENOENT') {
      await createAcmeAccount(acme, email);
    } else {
      throw error;
    }
  }

  const accountKeyPem = await fs.promises.readFile('./config/acme-account.pem', 'ascii');
  const accountKey = await Keypairs.import({ pem: accountKeyPem });
  const account = await acme.accounts.create({
    subscriberEmail: email,
    agreeToTerms: true,
    accountKey
  });

  console.info('loaded account with id', account.key.kid);

  return { account, accountKey };
}

function waitForResult (fn) {
  return new Promise((resolve, reject) => {
    let pollInterval = null;

    const timeoutTimeout = setTimeout(() => {
      clearInterval(pollInterval);
      clearTimeout(timeoutTimeout);
      reject(new Error('waitForResult timed out'));
    }, 30000);

    pollInterval = setInterval(async () => {
      const result = await fn();
      if (result) {
        clearInterval(pollInterval);
        clearTimeout(timeoutTimeout);
        resolve(result);
      }
    }, 1000);
  });
}

async function getCertificateForDomain (scope, domain) {
  const { db } = scope;

  // Already in database (success)
  const existingCertificate = await getCertificateFromDb(db, domain, { status: 'success' });

  if (existingCertificate) {
    if (existingCertificate.dateRenewal < Date.now()) {
      generateCertificateForDomain(scope, domain).catch(error => {
        console.log(error);
      });
    }

    return {
      key: existingCertificate.privatekey,
      cert: existingCertificate.fullchain
    };
  }

  // Already in database (pending)
  const pendingCertificate = await getCertificateFromDb(db, domain);

  if (pendingCertificate) {
    console.log('acmeUtils: already in database, but not finished');
    await waitForResult(() => {
      return getCertificateFromDb(db, domain, { status: 'success' });
    }, [domain]);
    return getCertificateForDomain(scope, domain);
  }

  await generateCertificateForDomain(scope, domain);

  return getCertificateForDomain(scope, domain);
}

async function generateCertificateForDomain (scope, domain) {
  const { db, settings } = scope;

  const temporaryRecord = await db.post('certificates', {
    domain,
    status: 'pending',
    dateCreated: Date.now()
  });

  const email = settings.acmeEmail;

  const errors = [];
  function notify (ev, msg) {
    if (ev === 'error' || ev === 'warning') {
      errors.push(ev.toUpperCase() + ' ' + msg.message);
      return;
    }
    console.log(ev, msg.altname || '', msg.status || '');
  }

  const acme = ACME.create({ maintainerEmail: email, packageAgent, notify });
  await acme.init(settings.acmeDirectoryUrl);

  const { account, accountKey } = await getAcmeAccount(acme, email);

  // Generate server certificates
  const serverKeypair = await Keypairs.generate({ kty: 'RSA', format: 'jwk' });
  const serverKey = serverKeypair.private;
  const serverPem = await Keypairs.export({ jwk: serverKey });

  const encoding = 'der';
  const typ = 'CERTIFICATE REQUEST';

  const domains = [domain];
  const csrDer = await CSR.csr({ jwk: serverKey, domains, encoding });
  const csr = PEM.packBlock({ type: typ, bytes: csrDer });

  const challenges = {
    'http-01': {
      init: async function () {
        return null;
      },
      set: async function (data) {
        await db.patch('certificates', {
          challenge: data.challenge,
          token: data.challenge.token
        }, {
          query: {
            id: temporaryRecord.id
          }
        });

        return null;
      },
      get: async function (data) {
        const result = await db.getOne('challenge', {
          query: {
            token: data.challenge.token
          }
        });

        return result.challenge;
      },
      remove: async function (data) {
        // Will cleanup at the end
      }
    }
  };

  console.info('validating domain authorization for ' + domains.join(' '));
  const pems = await acme.certificates.create({
    account,
    accountKey,
    csr,
    domains,
    challenges
  });
  const fullchain = pems.cert + '\n' + pems.chain + '\n';

  await db.post('certificates', {
    domain,
    status: 'success',
    fullchain,
    privatekey: serverPem,
    dateRenewal: Date.now() + ((24 * 40) * 60 * 60 * 1000),
    dateCreated: Date.now()
  });

  getCachedCertificate.clear();

  await db.delete('certificates', {
    query: {
      id: temporaryRecord.id
    }
  });

  if (errors.length) {
    console.warn();
    console.warn('[Warning]');
    console.warn('The following warnings and/or errors were encountered:');
    console.warn(errors.join('\n'));
  }
}

function getCertificateHandler (scope, options) {
  return async (servername, cb) => {
    const ctx = await getCachedCertificate(scope, options, servername);

    if (cb) {
      cb(null, ctx);
    } else {
      return ctx;
    }
  };
}

async function handleHttpChallenge ({ db, settings }, request, response) {
  const token = request.url.replace('/.well-known/acme-challenge/', '');

  const certificates = await db.getAll('certificates', {
    query: {
      token: token
    }
  });

  for (const certificate of certificates) {
    const challenge = certificate.challenge;
    if (!challenge) {
      continue;
    }

    if (challenge.challengeUrl === `http://${request.headers.host}${request.url}`) {
      response.end(challenge.keyAuthorization);
      return true;
    }
  }
  return false;
}

function createHttpHandler (settings, scope, handler) {
  return async function (request, response) {
    hint('puzed.router:request', 'incoming request', request.method, request.headers.host, request.url);

    if (!request.headers.host || isIp(request.headers.host.split(':')[0])) {
      hint('puzed.router:respond', `replying with ${hint.redBright('statusCode 404')} as no host header was provided`);
      response.writeHead(404, { 'content-type': 'text/html' });
      response.end('No domain provided');
      return;
    }

    if (await handleHttpChallenge(scope, request, response)) {
      return;
    }

    if (settings.forceHttps) {
      const redirectUrl = 'https://' + request.headers.host + request.url;
      hint('puzed.router:respond', `redirecting to ${redirectUrl}`);
      response.writeHead(302, { location: redirectUrl });
      response.end();
      return;
    }

    handler(request, response);
  };
}

module.exports = {
  getCertificateFromDb,
  createHttpHandler,
  getCertificateHandler,
  handleHttpChallenge
};
