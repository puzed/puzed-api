const http = require('http');

const routemeup = require('routemeup');
const hint = require('hinton');

const createHttpsServer = require('./createHttpsServer');
const proxyToInstance = require('./common/proxyToInstance');
const proxyToClient = require('./common/proxyToClient');
const networkProxy = require('./common/networkProxy');
const handleError = require('./common/handleError');
const acmeUtilities = require('./common/acmeUtilities');

const performHealthchecks = require('./jobs/healthchecks');
const performScaling = require('./jobs/scaling');
const performDeployInstances = require('./jobs/deployInstances');
const performContainerLoggers = require('./jobs/containerLoggers');
const performAutoSwitches = require('./jobs/autoSwitches');
const performDomainValidations = require('./jobs/domainValidations');
const performUsageCalculations = require('./jobs/usageCalculations');

async function createServer (scope) {
  const { settings, notify, db, scheduler, config } = scope;

  let networkProxyInstance;
  if (settings.networkMicroManagement) {
    networkProxyInstance = networkProxy(scope);
  }

  scheduler.add(() => performHealthchecks(scope), 3000);
  scheduler.add(() => performScaling(scope), 3000);
  scheduler.add(() => performContainerLoggers(scope), 3000);
  scheduler.add(() => performDeployInstances(scope), 3000);
  scheduler.add(() => performAutoSwitches(scope), 3000);
  scheduler.add(() => performDomainValidations(scope), 3000);
  scheduler.add(() => performUsageCalculations(scope), 3000);

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
      ...scope.providers.controllers,
      ...controllers
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

  const controllers = require('./controllers');

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
    scope.close();
    networkProxyInstance && networkProxyInstance.close();
    scheduler.cancelAndStop();
  });

  httpServer.listen(config.httpPort);

  const httpsServer = createHttpsServer(config, scope, handler);

  return {
    db,
    httpServer,
    httpsServer
  };
}

module.exports = createServer;
