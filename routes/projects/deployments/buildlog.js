const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');
const https = require('https');

const authenticate = require('../../../common/authenticate');

async function logDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await postgres.getOne(db, `
    SELECT "deployments".*
      FROM "deployments"
 LEFT JOIN "projects" ON "deployments"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2 AND "deployments"."id" = $3
  `, [user.id, tokens.projectId, tokens.deploymentId]);

  if (!deployment) {
    writeResponse(404, { error: 'not found' }, response);
    return;
  }

  const server = await postgres.getOne(db, 'SELECT * FROM "servers" WHERE "hostname" = $1', [deployment.dockerHost]);
  if (['building', 'starting'].includes(deployment.status)) {
    https.request(`https://${server.hostname}:${server.apiPort}/internal/deployments/${deployment.id}/buildlog`, {
      headers: {
        host: config.domains.api[0],
        'x-internal-secret': config.internalSecret
      }
    }, function (liveLogResponse) {
      liveLogResponse.pipe(response);
    }).end();
    return;
  }

  writeResponse(200, deployment.buildLog, response);
}

module.exports = logDeployment;
