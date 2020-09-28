const generateAccessToken = require('./generateAccessToken');
const providerOauthRoute = require('./providerOauthRoute');
const listRepositoriesHandler = require('./listRepositoriesHandler');
const webhookEndpointHandler = require('./webhookEndpointHandler');
const listBranchesForRepositoryHandler = require('./listBranchesForRepositoryHandler');
const getLatestCommitHash = require('./getLatestCommitHash');
const cloneRepository = require('./cloneRepository');

function githubProvider ({ db, config }) {
  db.run(`
    CREATE TABLE IF NOT EXISTS "githubUserLinks" (
      "id" varchar PRIMARY KEY,
      "userId" varchar,
      "githubUsername" varchar,
      "githubInstallationId" varchar,
      "dateCreated" varchar
    );
  `);

  return {
    generateAccessToken,
    cloneRepository,
    getLatestCommitHash,

    routes: {
      '/providers/github/repositories/:owner/:repo/branches': {
        GET: listBranchesForRepositoryHandler
      },

      '/providers/github/repositories': {
        GET: listRepositoriesHandler
      },

      '/providers/github/webhookEndpoint': {
        POST: webhookEndpointHandler
      },

      '/providers/github/oauth': {
        POST: providerOauthRoute
      }
    }
  };
}

module.exports = githubProvider;
