const writeResponse = require('write-response');

const authenticate = require('../../../common/authenticate');

const getDeploymentById = require('../../../services/deployments/getDeploymentById');

async function readDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await getDeploymentById({ db }, user.id, tokens.projectId, tokens.deploymentId);

  if (!deployment) {
    throw Object.assign(new Error('deployment not found'), { statusCode: 404 });
  }

  writeResponse(200, {
    ...deployment
  }, response);
}

module.exports = readDeployment;
