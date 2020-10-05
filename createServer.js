const http = require('http');

const routemeup = require('routemeup');
const createNotifyServer = require('notify-over-http');

const hint = require('./modules/hint');

const database = require('./common/database');
const migrationDriver = require('./migrations');
const { getMigrationsFromDirectory, up } = require('node-mini-migrations');

const createHttpsServer = require('./createHttpsServer');
const proxyToInstance = require('./common/proxyToInstance');
const proxyToClient = require('./common/proxyToClient');

const handleError = require('./common/handleError');
const acmeUtilities = require('./common/acmeUtilities');
const performHealthchecks = require('./common/performHealthchecks');
const performAutoSwitches = require('./common/performAutoSwitches');
const performDomainValidations = require('./common/performDomainValidations');

const timers = [];

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

async function createServer (config) {
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

  timers.push(
    setInterval(() => performHealthchecks(scope), 3000)
  );

  timers.push(
    setInterval(() => performAutoSwitches(scope), 3000)
  );

  timers.push(
    setInterval(() => performDomainValidations(scope), 3000)
  );

  function handleApiRoute (scope, request, response, url) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', '*');
    response.setHeader('Access-Control-Allow-Headers', 'authorization');

    if (request.method === 'OPTIONS') {
      response.end();
      return;
    }

    if (url.startsWith('/notify')) {
      hint('puzed.router:request', 'sending request to notify handler');
      return notify.handle(request, response);
    }

    const route = routemeup({
      ...scope.providers.routes,
      ...routes
    }, { method: request.method, url });
    if (route) {
      const result = route.controller(scope, request, response, route.tokens);
      if (result.catch) {
        result.catch((error) => {
          handleError(error, request, response);
        });
      }
      return;
    }

    hint('puzed.router:respond', `replying with ${hint.redBright('statusCode 404')} as not route for path "${hint.redBright(url)}" was found`);
    response.writeHead(404);
    response.end(`Path ${url} not found`);
  }

  const routes = require('./routes');

  async function handler (request, response) {
    hint('puzed.router:request', 'incoming request', request.method, request.headers.host, request.url);

    if (settings.domains.api.includes(request.headers.host)) {
      handleApiRoute(scope, request, response, request.url);
      return;
    }

    if (settings.domains.client.includes(request.headers.host)) {
      hint('puzed.router.proxy', `proxying host "${request.headers.host}" to the puzed http client`);
      if (request.url.startsWith('/api/')) {
        const url = request.url.slice(4);
        handleApiRoute(scope, request, response, url);
        return;
      }

      proxyToClient(scope, request, response);
      return;
    }

    hint('puzed.router.proxy', `proxying host "${request.headers.host}" to a instance`);
    proxyToInstance(scope, request, response);
  }
  const httpServer = http.createServer(acmeUtilities.createHttpHandler(settings, scope, handler));

  httpServer.on('listening', () => {
    hint('puzed.router', 'listening (http) on port:', httpServer.address().port);
  });

  httpServer.on('close', function () {
    db.close();
    timers.forEach(timer => clearTimeout(timer));
    timers.forEach(timer => clearInterval(timer));
  });

  httpServer.listen(config.httpPort);

  const httpsServer = createHttpsServer(config, scope, handler);

  return {
    httpServer,
    httpsServer
  };
}

module.exports = createServer;
