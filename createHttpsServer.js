const https = require('https');
const fs = require('fs');

const acmeUtilities = require('./common/acmeUtilities');
const hint = require('hinton');

const defaultCertificates = {
  key: fs.readFileSync('./config/default.key', 'ascii'),
  cert: fs.readFileSync('./config/default.cert', 'ascii')
};

function createHttpsServer (config, scope, handler) {
  const { db, settings } = scope;

  const httpsServer = https.createServer({
    SNICallback: acmeUtilities.getCertificateHandler(scope, {
      defaultCertificates,
      isAllowedDomain: async domain => {
        const mainDomain = domain.split('--')[1] || domain;
        const allowedService = await db.getOne('services', {
          query: {
            domain: {
              $in: [domain, mainDomain]
            }
          }
        });
        const allowedCertificate = await acmeUtilities.getCertificateFromDb(db, domain);

        return settings.domains.api.includes(domain) || settings.domains.client.includes(domain) || allowedService || allowedCertificate;
      }
    })
  }, handler);
  httpsServer.on('listening', () => {
    hint('puzed.router', 'listening (https) on port:', httpsServer.address().port);
  });
  httpsServer.listen(config.httpsPort);

  return httpsServer;
}

module.exports = createHttpsServer;
