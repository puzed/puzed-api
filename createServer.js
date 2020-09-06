const http = require('http');
const https = require('https');
const isIp = require('is-ip');
const fs = require('fs');

const postgres = require('postgres-fp/promises');
const routemeup = require('routemeup');

const migrateDatabase = require('./migrateDatabase');
const proxyToDeployment = require('./proxyToDeployment');
const proxyToClient = require('./proxyToClient');

const handleError = require('./common/handleError');
const { getCertificate, handleHttpChallenge } = require('./common/acmeUtilities');
const performHealthchecks = require('./common/performHealthchecks');

const defaultCertificates = {
  key: fs.readFileSync('./config/default.key', 'ascii'),
  cert: fs.readFileSync('./config/default.cert', 'ascii')
};

async function createServer (config) {
  const db = await postgres.connect(config.cockroach);

  setInterval(() => performHealthchecks({ config, db }), 3000);

  await migrateDatabase(db);

  const routes = {
    '/projects': {
      GET: require('./routes/projects/list'),
      POST: require('./routes/projects/create')
    },

    '/projects/:projectId': {
      GET: require('./routes/projects/read')
    },

    '/projects/:projectId/deployments/:deploymentId/log': {
      GET: require('./routes/projects/deployments/log')
    },

    '/projects/:projectId/deployments/:deploymentId/buildlog': {
      GET: require('./routes/projects/deployments/buildlog')
    },

    '/projects/:projectId/deployments/:deploymentId': {
      DELETE: require('./routes/projects/deployments/delete')
    },

    '/projects/:projectId/deployments': {
      POST: require('./routes/projects/deployments/create'),
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

    if (config.domains.api.includes(request.headers.host)) {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', '*');
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

      return;
    }

    if (config.domains.client.includes(request.headers.host)) {
      proxyToClient(scope, request, response);
      return;
    }

    proxyToDeployment(scope, request, response);
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
    if (isIp(request.headers.host.split(':')[0])) {
      if (request.headers['x-internal-secret'] === config.internalSecret) {
        const routes = {
          '/internal/deployments/:deploymentId': {
            POST: require('./routes/internal/deployments/deploy'),
            DELETE: require('./routes/internal/deployments/delete')
          },
          '/internal/deployments/:deploymentId/buildlog': {
            GET: require('./routes/internal/deployments/buildlog')
          },
          '/internal/deployments/:deploymentId/livelog': {
            GET: require('./routes/internal/deployments/livelog')
          }
        };

        const route = routemeup(routes, request);
        if (route) {
          const result = route.controller(scope, request, response, route.tokens);
          if (result && result.catch) {
            result.catch((error) => {
              handleError(error, request, response);
            });
          }
          return;
        }
      }

      response.writeHead(401, { 'content-type': 'text/html' });
      response.end(`
        <body style="background: #eeeeee;">
          <h1 style="text-align: center; font-family: monospace;">Have a fantastic day!</h1>
          <div style="width: 100vw; height: 100vh; background-size: contain; background-repeat: no-repeat; background-image: url('https://cdn.pixabay.com/photo/2016/03/12/19/34/city-1252643_1280.png');">
        </body>
      `.trim());
      return;
    }

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
