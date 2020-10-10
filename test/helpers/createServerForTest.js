const database = require('../../common/database');
const createServer = require('../../createServer');

const buildInsertStatement = require('../../common/buildInsertStatement');

const migrationDriver = require('../../migrations');
const { getMigrationsFromDirectory, up } = require('node-mini-migrations');

function insert (db, tableName, record) {
  const statement = buildInsertStatement(tableName, record);
  return db.run(statement.sql, statement.parameters);
}

const config = {
  httpPort: 8080,
  httpsPort: 8443,
  serverId: 'manual-local',
  forceHttps: false,
  dockerRuntime: 'runc',
  cockroach: process.env.IS_INSIDE_TRAVIS ? {
    host: 'localhost',
    database: 'test',
    user: 'postgres',
    password: 'mysecretpassword',
    port: 5432
  } : {
    host: process.env.COCKROACH_HOST || '127.0.0.1',
    database: process.env.COCKROACH_DATABASE || 'test',
    user: process.env.COCKROACH_USER || 'root',
    port: process.env.COCKROACH_PORT || 26257,
    ssl: {
      rejectUnauthorized: false,
      caFile: process.env.COCKROACH_CA_FILE || './config/cockroachCa.crt',
      keyFile: process.env.COCKROACH_KEY_FILE || './config/cockroachNode.key',
      certFile: process.env.COCKROACH_CERT_FILE || './config/cockroachNode.crt'
    }
  }
};

async function wipe (db) {
  await Promise.all([
    db.run('CREATE DATABASE "test";'),
    db.run('DROP TABLE "_migrations";'),
    db.run('DROP TABLE "services";'),
    db.run('DROP TABLE "deployments";'),
    db.run('DROP TABLE "instances";'),
    db.run('DROP TABLE "users";'),
    db.run('DROP TABLE "sessions";'),
    db.run('DROP TABLE "servers";'),
    db.run('DROP TABLE "providers";'),
    db.run('DROP TABLE "links";'),
    db.run('DROP TABLE "settings";'),
    db.run('DROP TABLE "certificates";'),
    db.run('DROP TABLE "networkRules";')
  ]).catch(_ => () => {});

  await up(migrationDriver(db), getMigrationsFromDirectory('./migrations'));

  await prepareDefaultData(db);

  process.testHasWipedDatabase = true;
}

async function prepareDefaultData (db) {
  return Promise.all([
    insert(db, 'settings', {
      key: 'domains',
      value: JSON.stringify({
        api: ['localhost:8443'],
        client: ['puzed.test']
      })
    }),

    insert(db, 'settings', {
      key: 'hashConfig',
      value: JSON.stringify({
        encoding: 'hex',
        digest: 'sha256',
        hashBytes: 32,
        saltBytes: 16,
        iterations: 1
      })
    }),

    insert(db, 'settings', {
      key: 'installed',
      value: JSON.stringify(true)
    }),

    insert(db, 'settings', {
      key: 'acmeDirectoryUrl',
      value: JSON.stringify('none')
    }),

    insert(db, 'settings', {
      key: 'forceHttps',
      value: JSON.stringify(true)
    }),

    insert(db, 'settings', {
      key: 'acmeEmail',
      value: JSON.stringify('test@example.com')
    }),

    insert(db, 'settings', {
      key: 'secret',
      value: JSON.stringify('testsecret')
    }),

    insert(db, 'servers', {
      id: 'first',
      hostname: '0.0.0.0',
      apiPort: '443',
      dateCreated: Date.now()
    })
  ]);
}

async function clean (db) {
  await Promise.all([
    db.run('DELETE FROM "services";'),
    db.run('DELETE FROM "deployments";'),
    db.run('DELETE FROM "instances";'),
    db.run('DELETE FROM "links";'),
    db.run('DELETE FROM "providers";'),
    db.run('DELETE FROM "settings";'),
    db.run('DELETE FROM "sessions";'),
    db.run('DELETE FROM "servers";'),
    db.run('DELETE FROM "certificates";'),
    db.run('DELETE FROM "networkRules";')
  ]);

  await prepareDefaultData(db);
}

let server;
let closeTimer;
let db;

async function createServerForTest (configOverrides) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  db = db || await database.connect(config.cockroach);

  clearTimeout(closeTimer);

  if (process.testHasWipedDatabase) {
    await clean(db);
  } else {
    await wipe(db);
  }

  if (!server) {
    server = await createServer({
      ...config,
      ...configOverrides,
      db
    });
  }

  return {
    config,
    httpUrl: 'http://localhost:8080',
    httpsUrl: 'https://localhost:8443',
    db,
    insert: insert.bind(null, db),
    close: () => {
      closeTimer = setTimeout(() => {
        server.httpsServer.close();
        server.httpServer.close();
      }, 500);
    },
    ...server
  };
}

module.exports = createServerForTest;
