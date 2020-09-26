const http = require('http');

const routemeup = require('routemeup');
const createNotifyServer = require('notify-over-http');

const hint = require('./modules/hint');

const database = require('./common/database');

const createHttpsServer = require('./createHttpsServer');
const setupDatabase = require('./setupDatabase');
const proxyToInstance = require('./common/proxyToInstance');
const proxyToClient = require('./common/proxyToClient');

const handleError = require('./common/handleError');
const acmeUtilities = require('./common/acmeUtilities');
const performHealthchecks = require('./common/performHealthchecks');

async function createServer (config) {
  hint('puzed.db', 'connecting');
  const db = await database.connect(config.cockroach);

  await setupDatabase(db);

  hint('puzed.db', 'fetching all servers');
  const servers = await db.getAll('SELECT * FROM "servers"');

  hint('puzed.notify', 'creating notify server');
  const notify = createNotifyServer({
    servers: servers
      .map(server => ({
        url: `https://${server.hostname}:${server.apiPort}/notify`,
        headers: {
          host: config.domains.api[0]
        }
      }))
  });

  const scope = {
    config,
    notify,
    db
  };

  setInterval(() => performHealthchecks(scope), 3000);

  const routes = require('./routes');

  async function handler (request, response) {
    hint('puzed.router:request', 'incoming request', request.method, request.headers.host, request.url);

    if (config.domains.api.includes(request.headers.host)) {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', '*');
      response.setHeader('Access-Control-Allow-Headers', 'authorization');

      if (request.method === 'OPTIONS') {
        response.end();
        return;
      }

      if (request.url.startsWith('/notify')) {
        hint('puzed.router:request', 'sending request to notify handler');
        return notify.handle(request, response);
      }

      const route = routemeup(routes, request);
      if (route) {
        const result = route.controller(scope, request, response, route.tokens);
        if (result.catch) {
          result.catch((error) => {
            handleError(error, request, response);
          });
        }
        return;
      }

      hint('puzed.router:respond', `replying with ${hint.redBright('statusCode 404')} as not route for path "${hint.redBright(request.url)}" was found`);
      response.writeHead(404);
      response.end(`Path ${request.url} not found`);

      return;
    }

    if (config.domains.client.includes(request.headers.host)) {
      hint('puzed.router.proxy', `proxying host "${request.headers.host}" to the puzed http client`);
      proxyToClient(scope, request, response);
      return;
    }

    hint('puzed.router.proxy', `proxying host "${request.headers.host}" to a instance`);
    proxyToInstance(scope, request, response);
  }
  const httpServer = http.createServer(acmeUtilities.createHttpHandler(config, scope, handler));

  httpServer.on('listening', () => {
    hint('puzed.router', 'listening (http) on port:', httpServer.address().port);
  });

  httpServer.on('close', function () {
    db.end();
  });

  httpServer.listen(config.httpPort);

  const httpsServer = createHttpsServer(config, scope, handler);

  return {
    httpServer,
    httpsServer
  };
}

module.exports = createServer;
