const http = require('http');
const https = require('https');
const fs = require('fs');

const postgres = require('postgres-fp/promises');
const axios = require('axios');
const routemeup = require('routemeup');

const handleError = require('./common/handleError');
const { getCertificate, handleHttpChallenge } = require('./common/acmeUtilities');

const defaultCertificates = {
  key: fs.readFileSync('./config/default.key', 'ascii'),
  cert: fs.readFileSync('./config/default.cert', 'ascii')
};

async function proxyToDeployment ({ db }, request, response) {
  const record = await postgres.getOne(db, `
    SELECT dockerhost, dockerid, dockerport
      FROM deployments
 LEFT JOIN projects ON projects.id = deployments.projectId
     WHERE domain = $1
  ORDER BY random()
     LIMIT 1
  `, [request.headers.host]);

  if (!record) {
    response.writeHead(404);
    response.end(`Domain ${request.headers.host} is not hosted here`);
    return;
  }

  const proxyRequest = http.request(`http://${record.dockerhost}:${record.dockerport}${request.url}`, function (proxyResponse) {
    proxyResponse.pipe(response);
  });

  proxyRequest.end();
}

async function createServer (config) {
  const db = await postgres.connect(config.cockroach);

  await postgres.run(db, `
    CREATE TABLE IF NOT EXISTS projects (
      id varchar,
      name varchar,
      image varchar,
      webport varchar,
      domain varchar,
      owner varchar,
      repo varchar,
      publicKey varchar,
      privateKey varchar,
      username varchar
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id varchar,
      projectId varchar,
      dockerPort varchar,
      dockerHost varchar,
      dockerId varchar,
      buildLog text,
      status varchar
    );
  `);

  const routes = {
    '/projects': {
      GET: require('./routes/projects/list'),
      POST: require('./routes/projects/create')
    },

    '/projects/:projectId': {
      GET: require('./routes/projects/read')
    },

    '/auth': {
      POST: async (scope, request, response) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const token = url.searchParams.get('token');

        try {
          const oauthResponse = await axios({
            method: 'post',
            url: `https://github.com/login/oauth/access_token?client_id=${config.githubClientId}&client_secret=${config.githubClientSecret}&code=${token}`,
            headers: {
              accept: 'application/json'
            },
            data: JSON.stringify({
              scope: 'repo'
            })
          });

          if (oauthResponse.data.error) {
            response.writeHead(401, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(oauthResponse.data));
            return;
          }

          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(oauthResponse.data));
        } catch (error) {
          console.log(error);
          response.writeHead(500);
          response.end('Unexpected server error');
        }
      }
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
        })
      }
      return
    }

    response.writeHead(404);
    response.end(`Path ${request.url} not found`);
  }

  const httpsServer = https.createServer({
    SNICallback: getCertificate(scope, { defaultCertificates })
  }, handler);
  httpsServer.on('listening', () => {
    console.log('Listening (https) on port:', httpsServer.address().port);
  });
  httpsServer.listen(443);

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

  httpServer.listen(80);

  return {
    httpServer,
    httpsServer
  };
}

module.exports = createServer;
