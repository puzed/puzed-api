const writeResponse = require('write-response');
const finalStream = require('final-stream');

const getDeploymentById = require('../../../services/deployments/getDeploymentById');
const buildUpdateStatement = require('../../../common/buildUpdateStatement');
const authenticate = require('../../../common/authenticate');

async function patchDeployment ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const body = await finalStream(request)
    .then(buffer => buffer.toString('utf8'))
    .then(JSON.parse);

  const deployment = await getDeploymentById({ db }, user.id, tokens.serviceId, tokens.deploymentId);
  if (!deployment) {
    throw Object.assign(new Error('deployment not found'), { statusCode: 404 });
  }

  const statement = buildUpdateStatement('deployments', `
    WHERE "deployments"."id" = $1
  `, [tokens.deploymentId, body]);
  await db.run(statement.sql, statement.parameters);

  const deploymentResult = await getDeploymentById({ db }, user.id, tokens.serviceId, tokens.deploymentId);

  writeResponse(200, {
    ...deploymentResult
  }, response);
}

module.exports = patchDeployment;
