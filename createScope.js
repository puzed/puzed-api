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
  function wrapCommand (command, args) {
    const title = 'db.' + command + ':' + args[0];
    scope.metrics && scope.metrics.inc(title);
    const startTime = Date.now();
    return db[command](...args)
      .then(result => {
        const duration = Date.now() - startTime;
        scope.metrics && scope.metrics.set(title, duration);
        return result;
      });
  }

  return {
    ...db,

    count: (...args) => {
      return wrapCommand('count', args);
    },

    getAll: (...args) => {
      return wrapCommand('getAll', args);
    },

    getOne: (...args) => {
      return wrapCommand('getOne', args);
    },

    post: (...args) => {
      return wrapCommand('post', args);
    },

    put: (...args) => {
      return wrapCommand('put', args);
    },

    patch: (...args) => {
      return wrapCommand('patch', args);
    },

    delete: (...args) => {
      return wrapCommand('delete', args);
    }
  };
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
    scope.settings = await loadSettingsFromDatabase(config, scope.db, 'settings');
  };

  scope.providers = require('./providers')(scope);

  return scope;
}

module.exports = createScope;
