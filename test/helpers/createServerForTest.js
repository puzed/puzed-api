const database = require('../../common/database');
const createServer = require('../../createServer');

const config = {
  httpPort: 8080,
  httpsPort: 8443,
  serverId: 'manual-local',
  forceHttps: false,
  domains: {
    api: ['localhost:8443'],
    client: []
  },
  dockerRuntime: 'runc',
  internalSecret: 'CHANGE_ME',
  responsibilities: ['localhost'],
  email: 'me@markwylde.com',
  directoryUrl: 'https://acme-staging-v02.api.letsencrypt.org/directory',
  cockroach: {
    host: 'localhost',
    database: 'test',
    user: 'postgres',
    password: 'mysecretpassword',
    port: 5432
  },
  hashConfig: {
    encoding: 'hex',
    digest: 'sha256',
    hashBytes: 32,
    saltBytes: 16,
    iterations: 1
  }
};

async function wipe () {
  const db = await database.connect(config.cockroach);
  await db.run(`
    DROP TABLE IF EXISTS "_migrations";
    DROP TABLE IF EXISTS "services";
    DROP TABLE IF EXISTS "deployments";
    DROP TABLE IF EXISTS "instances";
    DROP TABLE IF EXISTS "githubDeploymentKeys";
    DROP TABLE IF EXISTS "users";
    DROP TABLE IF EXISTS "sessions";
    DROP TABLE IF EXISTS "servers";
    DROP TABLE IF EXISTS "certificates";
  `);
  await db.close();

  process.testHasWipedDatabase = true;
}

async function clean () {
  const db = await database.connect(config.cockroach);

  await db.run(`
    DELETE FROM "services";
    DELETE FROM "deployments";
    DELETE FROM "instances";
    DELETE FROM "githubDeploymentKeys";
    DELETE FROM "users";
    DELETE FROM "sessions";
    DELETE FROM "servers";
    DELETE FROM "certificates";
  `).catch(error => {
    if (!error.message.includes('does not exist')) {
      throw error;
    }
  });

  await db.close();
}

async function createServerForTest (configOverrides) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  if (process.testHasWipedDatabase) {
    await clean();
  } else {
    await wipe();
  }

  const server = await createServer({
    ...config,
    ...configOverrides
  });

  return {
    config,
    httpUrl: 'http://localhost:8080',
    httpsUrl: 'https://localhost:8443',
    close: () => {
      server.httpsServer.close();
      server.httpServer.close();
    },
    ...server
  };
}

module.exports = createServerForTest;
