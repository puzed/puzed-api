const createNotifyServer = require('notify-over-http');

const hint = require('./modules/hint');

const database = require('./common/database');
const migrationDriver = require('./migrations');
const { getMigrationsFromDirectory, up } = require('node-mini-migrations');

async function loadSettingsFromDatabase (db) {
  const settings = await db.getAll('SELECT * FROM "settings"');

  const objectifiedSettings = settings.reduce((result, setting) => {
    result[setting.key] = setting.value;
    return result;
  }, {});

  if (!objectifiedSettings.installed) {
    console.log('Puzed instance is not installed. Will try again in 2 seconds.');
    await (() => new Promise(resolve => setTimeout(resolve, 2000)))();
    return loadSettingsFromDatabase(db);
  }

  return objectifiedSettings;
}

async function createScope (config) {
  hint('puzed.db', 'connecting');
  const db = config.db || await database.connect(config.cockroach);

  hint('puzed.db', 'running migrations');
  await up(migrationDriver(db), getMigrationsFromDirectory('./migrations'));

  hint('puzed.settings', 'grabbing settings from db');
  const settings = await loadSettingsFromDatabase(db, 'settings');

  hint('puzed.db', 'fetching all servers');
  const servers = await db.getAll('SELECT * FROM "servers"');

  hint('puzed.notify', 'creating notify server');
  const notify = createNotifyServer({
    servers: servers
      .map(server => ({
        url: `https://${server.hostname}:${server.apiPort}/notify`,
        headers: {
          host: settings.domains.api[0]
        }
      }))
  });

  const scope = {
    config,
    settings,
    notify,
    db
  };

  scope.providers = require('./providers')(scope);

  return scope;
}

module.exports = createScope;
