const generateAccessToken = require('./generateAccessToken');
const providerOauthRoute = require('./providerOauthRoute');
const webhookEndpointHandler = require('./webhookEndpointHandler');
const listBranchesForRepositoryHandler = require('./listBranchesForRepositoryHandler');
const listRepositories = require('./listRepositories');
const getLatestCommitHash = require('./getLatestCommitHash');
const cloneRepository = require('./cloneRepository');

function githubProvider ({ db, config }) {
  return {
    generateAccessToken,
    cloneRepository,
    listRepositories,
    getLatestCommitHash,

    routes: {
      '/providers/github/repositories/:owner/:repo/branches': {
        GET: listBranchesForRepositoryHandler
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
