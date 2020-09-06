const axios = require('axios');

const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function deleteDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await postgres.getOne(db, `
    SELECT "deployments".*
      FROM "deployments"
 LEFT JOIN "projects" ON "deployments"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2 AND "deployments"."id" = $3
 `, [user.id, tokens.projectId, tokens.deploymentId]);

  if (!deployment) {
    throw Object.assign(new Error('deployment not found'), { statusCode: 404 });
  }

  const server = await postgres.getOne(db, 'SELECT * FROM "servers" WHERE "hostname" = $1', [deployment.dockerHost]);
  await axios(`http://${server.hostname}:${server.apiPort}/internal/deployments/${deployment.id}`, {
    method: 'DELETE',
    headers: {
      'x-internal-secret': config.internalSecret
    }
  });

  writeResponse(200, '', response);
}

module.exports = deleteDeployment;
