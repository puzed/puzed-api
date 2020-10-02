const fs = require('fs');

const chalk = require('chalk');
const database = require('../../common/database');
const buildInsertStatement = require('../../common/buildInsertStatement');
const migrationDriver = require('../../migrations');
const { getMigrationsFromDirectory, up } = require('node-mini-migrations');

const ip = require('ip');

const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const stream = require('stream');
const finalStream = require('final-stream');

async function readFileInVolume (volumeName, filePath) {
  const stdout = new stream.PassThrough();

  await docker.run('alpine', ['cat', '/data' + filePath], stdout, {
    HostConfig: {
      AutoRemove: true,
      Mounts: [
        {
          Target: '/data',
          Source: volumeName,
          Type: 'volume',
          ReadOnly: false
        }
      ]
    }
  });

  return finalStream(stdout).then(buffer => buffer.toString());
}

function insert (db, tableName, record) {
  const statement = buildInsertStatement(tableName, record);
  return db.run(statement.sql, statement.parameters);
}

async function configurePuzed (options) {
  try {
    fs.writeFileSync('./config/cockroachCa.crt', await readFileInVolume('cockroachData', '/certs/ca.crt'));
    fs.writeFileSync('./config/cockroachNode.crt', await readFileInVolume('cockroachData', '/certs/node.crt'));
    fs.writeFileSync('./config/cockroachNode.key', await readFileInVolume('cockroachData', '/certs/node.key'), { mode: 0o600 });

    const config = {
      host: 'localhost',
      database: 'postgres',
      user: 'root',
      port: 26257,
      ssl: {
        rejectUnauthorized: false,
        caFile: process.env.COCKROACH_CA_FILE || './config/cockroachCa.crt',
        keyFile: process.env.COCKROACH_KEY_FILE || './config/cockroachNode.key',
        certFile: process.env.COCKROACH_CERT_FILE || './config/cockroachNode.crt'
      }
    };

    const db = await database.connect(config);

    await up(migrationDriver(db), getMigrationsFromDirectory('./migrations'));

    await Promise.all([
      insert(db, 'settings', {
        key: 'domains',
        value: JSON.stringify({
          api: options.apiDomains,
          client: options.clientDomains
        })
      }),

      insert(db, 'settings', {
        key: 'hashConfig',
        value: JSON.stringify({
          encoding: 'hex',
          digest: 'sha256',
          hashBytes: 32,
          saltBytes: 16,
          iterations: 372791
        })
      }),

      insert(db, 'settings', {
        key: 'installed',
        value: JSON.stringify(true)
      }),

      insert(db, 'settings', {
        key: 'acmeDirectoryUrl',
        value: JSON.stringify(options.acmeDirectoryUrl)
      }),

      insert(db, 'settings', {
        key: 'forceHttps',
        value: JSON.stringify(true)
      }),

      insert(db, 'settings', {
        key: 'acmeEmail',
        value: JSON.stringify(options.acmeEmail)
      }),

      insert(db, 'settings', {
        key: 'secret',
        value: JSON.stringify(options.secret)
      }),

      insert(db, 'servers', {
        id: 'first',
        hostname: ip.address(),
        apiPort: '443',
        dateCreated: Date.now()
      }),

      options.setupGithub && insert(db, 'providers', {
        id: 'github',
        driver: 'github',
        apiUrl: options.githubApiUrl.toString(),
        appId: options.githubAppId.toString(),
        clientId: options.githubClientId.toString(),
        clientSecret: options.githubClientSecret.toString(),
        clientKey: options.githubClientKey.toString()
      })
    ]);

    await db.close();
    console.log('  done');
  } catch (error) {
    console.log(error.response ? error.response.data : error);
    console.log('  ', chalk.red('fail'), 'could not configure puzed instance');
    throw error;
  }
}

module.exports = configurePuzed;
