const fs = require('fs');
const chalk = require('chalk');
const canhazdbClient = require('canhazdb-client');
const canhazdbServer = require('canhazdb-server');

const createNotifyServer = require('notify-over-http');
const createMetricsEngine = require('./common/createMetricsEngine');
const hint = require('hinton');

const createScheduler = require('skeddy');

const tls = {
  key: fs.readFileSync('./certs/localhost.privkey.pem'),
  cert: fs.readFileSync('./certs/localhost.cert.pem'),
  ca: [fs.readFileSync('./certs/ca.cert.pem')],
  requestCert: true
};

async function loadSettingsFromDatabase (config, db) {
  const settings = await db.getAll('settings');

  const objectifiedSettings = settings.reduce((result, setting) => {
    result[setting.key] = setting.value;
    return result;
  }, {});

  if (!objectifiedSettings.installed && !config.hideUninstalledWarning) {
    console.log(chalk.yellow('Puzed instance is not installed'));
  }

  return objectifiedSettings;
}

function wrapMetrics (scope, db) {
  return {
    ...db,

    count: (...args) => {
      scope.metrics && scope.metrics.inc('count:' + args[0]);
      return db.count(...args);
    },

    getAll: (...args) => {
      scope.metrics && scope.metrics.inc('getAll:' + args[0]);
      return db.getAll(...args);
    },

    getOne: (...args) => {
      scope.metrics && scope.metrics.inc('getOne:' + args[0]);
      return db.getOne(...args);
    },

    post: (...args) => {
      scope.metrics && scope.metrics.inc('post:' + args[0]);
      return db.post(...args);
    },

    put: (...args) => {
      scope.metrics && scope.metrics.inc('put:' + args[0]);
      return db.put(...args);
    },

    patch: (...args) => {
      scope.metrics && scope.metrics.inc('patch:' + args[0]);
      return db.patch(...args);
    },

    delete: (...args) => {
      scope.metrics && scope.metrics.inc('delete:' + args[0]);
      return db.delete(...args);
    }
  }
}

async function createScope (config) {
  process.env.HINT = process.env.HINT || config.hint;

  const scope = {
    config
  };

  hint('puzed.db', 'connecting');
  scope.dataNode = config.createDataNode
    ? await canhazdbServer({
        host: 'localhost', port: 7061, queryPort: 8061, dataDirectory: config.dataDirectory, single: true, tls
      })
    : null;

  const dbConnection = await canhazdbClient(scope.dataNode ? scope.dataNode.url : 'https://localhost:8061', { tls });
  scope.db = wrapMetrics(scope, dbConnection);

  hint('puzed.settings', 'grabbing settings from dbx');
  scope.settings = await loadSettingsFromDatabase(config, scope.db, 'settings');

  hint('puzed.db', 'fetching all servers');
  scope.servers = await scope.db.getAll('servers');

  hint('puzed.metrics', 'starting metrics engine');
  scope.metrics = createMetricsEngine(scope);

  hint('puzed.notify', 'creating notify server');
  scope.notify = createNotifyServer({
    servers: scope.servers
      .map(server => ({
        url: `https://${server.hostname}:${server.apiPort}/notify`,
        headers: {
          host: scope.settings.domains.api[0]
        }
      }))
  });

  scope.scheduler = createScheduler();

  scope.close = () => {
    return Promise.all([
      scope.db.close(),
      scope.scheduler.cancelAndStop(),
      scope.dataNode && scope.dataNode.close()
    ]);
  };

  scope.reloadSettings = async () => {
    scope.settings = await loadSettingsFromDatabase(config, db, 'settings');
  };

  scope.providers = require('./providers')(scope);

  return scope;
}

module.exports = createScope;
