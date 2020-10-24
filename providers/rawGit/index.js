const webhookEndpointHandler = require('./webhookEndpointHandler');
const listBranchesForRepositoryHandler = require('./listBranchesForRepositoryHandler');
const getLatestCommitHash = require('./getLatestCommitHash');
const cloneRepository = require('./cloneRepository');

function rawGitProvider ({ db, config }) {
  return {
    cloneRepository,
    getLatestCommitHash,

    controllers: {
      '/providers/github/repositories/:owner/:repo/branches': {
        GET: listBranchesForRepositoryHandler
      },

      '/providers/github/webhookEndpoint': {
        POST: webhookEndpointHandler
      }
    }
  };
}

module.exports = rawGitProvider;
