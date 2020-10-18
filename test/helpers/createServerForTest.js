const fs = require('fs').promises;

const createScope = require('../../createScope');
const createServer = require('../../createServer');

async function prepareDefaultData (db) {
  return Promise.all([
    db.post('settings', {
      key: 'domains',
      value: {
        api: ['localhost:8443'],
        client: ['puzed.test']
      }
    }),

    db.post('settings', {
      key: 'hashConfig',
      value: {
        encoding: 'hex',
        digest: 'sha256',
        hashBytes: 32,
        saltBytes: 16,
        iterations: 1
      }
    }),

    db.post('settings', {
      key: 'installed',
      value: true
    }),

    db.post('settings', {
      key: 'acmeDirectoryUrl',
      value: 'none'
    }),

    db.post('settings', {
      key: 'forceHttps',
      value: true
    }),

    db.post('settings', {
      key: 'acmeEmail',
      value: 'test@example.com'
    }),

    db.post('settings', {
      key: 'secret',
      value: 'testsecret'
    }),

    db.post('servers', {
      id: 'first',
      hostname: '0.0.0.0',
      apiPort: '443',
      dateCreated: Date.now()
    })
  ]);
}

const config = {
  httpPort: 8080,
  httpsPort: 8443,
  serverId: 'manual-local',
  forceHttps: false,
  dockerRuntime: 'runc',
  dataDirectory: './canhazdata/test',
  hideUninstalledWarning: true
};

async function createServerForTest (configOverrides) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  await fs.rmdir('./canhazdata/test', { recursive: true });

  const scope = await createScope({
    ...config,
    ...configOverrides
  });
  await prepareDefaultData(scope.db);
  await scope.reloadSettings();

  const server = await createServer(scope);

  return {
    config,
    httpUrl: 'http://localhost:8080',
    httpsUrl: 'https://localhost:8443',
    db: () => server.db,
    close: () => {
      server.httpsServer.close();
      server.httpServer.close();
    },
    ...server
  };
}

module.exports = createServerForTest;
