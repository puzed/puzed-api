const generateAccessToken = require('./generateAccessToken');
const githubProviderOauthRoute = require('./githubProviderOauthRoute');
const githubListRepositoriesHandler = require('./githubListRepositoriesHandler');
const githubWebhookEndpointHandler = require('./githubWebhookEndpointHandler');

function githubProvider ({ db, config }) {
  db.run(`
    CREATE TABLE IF NOT EXISTS "githubUserLinks" (
      "id" varchar PRIMARY KEY,
      "userId" varchar,
      "githubUsername" varchar,
      "dateCreated" varchar
    );
  `);

  return {
    generateAccessToken,

    routes: {
      '/providers/github/repositories': {
        GET: githubListRepositoriesHandler
      },

      '/providers/github/webhookEndpoint': {
        POST: githubWebhookEndpointHandler
      },

      '/providers/github/oauth': {
        POST: githubProviderOauthRoute
      }
    }
  };
}

module.exports = githubProvider;
