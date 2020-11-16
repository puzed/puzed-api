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
      hostname: '0.0.0.0',
      apiPort: '8443',
      dateCreated: Date.now()
    })
  ]);
}

async function createServerForTest (configOverrides) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const config = {
    httpPort: 8080,
    httpsPort: 8443,
    forceHttps: false,
    dockerRuntime: 'runc',
    dataDirectory: './canhazdata/test',
    hideUninstalledWarning: true,
    createDataNode: true,
    dockerSocketPath: '/tmp/docker.mock.sock',
    automaticallyBuildDeployments: false
  };

  await Promise.all([
    fs.rmdir('./canhazdata/test', { recursive: true }),
    fs.unlink(config.dockerSocketPath).catch(_ => {})
  ]);

  const scope = await createScope({
    ...config,
    ...configOverrides
  });
  await prepareDefaultData(scope.db);
  await scope.reloadSettings();

  const serverRecord = await scope.db.getOne('servers');
  scope.config.serverId = serverRecord.id;

  const server = await createServer(scope);

  return {
    config,
    scope,
    httpUrl: 'http://localhost:8080',
    httpsUrl: 'https://localhost:8443',
    db: () => server.db,
    close: () => {
      return Promise.all([
        server.httpsServer.close(),
        server.httpServer.close(),
        server.db.close(),
        scope.close()
      ]);
    },
    ...server
  };
}

module.exports = createServerForTest;
