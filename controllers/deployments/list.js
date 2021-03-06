const writeResponse = require('write-response');

const authenticate = require('../../common/authenticate');

const listDeployments = require('../../queries/deployments/listDeployments');

async function listDeploymentsRoute ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const deployments = await listDeployments({ db }, user.id, tokens.serviceId);

  writeResponse(200, deployments, response);
}

module.exports = listDeploymentsRoute;
