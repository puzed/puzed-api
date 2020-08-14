const http = require('http');

const postgres = require('postgres-fp/promises');
const axios = require('axios');
const routemeup = require('routemeup');

async function createServer (config) {
  const db = await postgres.connect(config.cockroach);

  await postgres.run(db, `
    CREATE TABLE IF NOT EXISTS projects (
      id varchar,
      name varchar,
      webport varchar,
      domain varchar,
      owner varchar,
      repo varchar,
      username varchar
    )
  `);

  const routes = {
    '/projects': {
      GET: require('./routes/projects/list'),
      POST: require('./routes/projects/create')
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
  const server = http.createServer(function (request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'authorization');

    if (request.method === 'OPTIONS') {
      response.end();
      return;
    }

    const route = routemeup(routes, request);
    if (route) {
      return route.controller(scope, request, response, route.tokens);
    }

    response.writeHead(404);
    response.end('Not Found');
  });

  server.on('close', function () {
    postgres.close(db);
  });

  return server;
}

module.exports = createServer;
