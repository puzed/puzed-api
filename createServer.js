const http = require('http');
const https = require('https');
const fs = require('fs');

const postgres = require('postgres-fp/promises');
const routemeup = require('routemeup');

const migrateDatabase = require('./migrateDatabase');
const proxyToDeployment = require('./proxyToDeployment');

const handleError = require('./common/handleError');
const { getCertificate, handleHttpChallenge } = require('./common/acmeUtilities');

const defaultCertificates = {
  key: fs.readFileSync('./config/default.key', 'ascii'),
  cert: fs.readFileSync('./config/default.cert', 'ascii')
};

async function createServer (config) {
  const db = await postgres.connect(config.cockroach);

  await migrateDatabase(db);

  const routes = {
    '/projects': {
      GET: require('./routes/projects/list'),
      POST: require('./routes/projects/create')
    },

    '/projects/:projectId': {
      GET: require('./routes/projects/read')
    },

    '/projects/:projectId/deployments': {
      GET: require('./routes/projects/deployments/list')
    },

    '/auth': {
      POST: require('./routes/auth')
    }
  };

  const scope = {
    config,
    db
  };

  async function handler (request, response) {
    console.log('https: Incoming request:', request.method, request.headers.host, request.url);

    if (!config.domains.includes(request.headers.host)) {
      proxyToDeployment(scope, request, response);
      return;
    }

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'authorization');

    if (request.method === 'OPTIONS') {
      response.end();
      return;
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

    response.writeHead(404);
    response.end(`Path ${request.url} not found`);
  }

  const httpsServer = https.createServer({
    SNICallback: getCertificate(scope, {
      defaultCertificates,
      isAllowedDomain: async domain => {
        const allowedProject = await postgres.getOne(db, 'SELECT * FROM projects WHERE $1 LIKE domain', [domain]);
        const allowedCertificate = await postgres.getOne(db, 'SELECT * FROM certificates WHERE $1 LIKE domain', [domain]);
        return allowedProject || allowedCertificate;
      }
    })
  }, handler);
  httpsServer.on('listening', () => {
    console.log('Listening (https) on port:', httpsServer.address().port);
  });
  httpsServer.listen(config.httpsPort);

  const httpServer = http.createServer(async function (request, response) {
    console.log('http: Incoming request:', request.method, request.headers.host, request.url);

    if (await handleHttpChallenge(scope, request, response)) {
      return;
    }

    response.writeHead(302, { location: 'https://' + request.headers.host + request.url });
    response.end();
  });

  httpServer.on('listening', () => {
    console.log('Listening (http) on port:', httpServer.address().port);
  });

  httpServer.on('close', function () {
    postgres.close(db);
  });

  httpServer.listen(config.httpPort);

  return {
    httpServer,
    httpsServer
  };
}

module.exports = createServer;
