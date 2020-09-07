const https = require('https');

const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function logDeployment ({ db, config }, request, response, tokens) {
  request.setTimeout(60 * 60 * 1000);
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await postgres.getOne(db, `
    SELECT "deployments".*
      FROM "deployments"
 LEFT JOIN "projects" ON "deployments"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2 AND "deployments"."id" = $3
  `, [user.id, tokens.projectId, tokens.deploymentId]);

  if (deployment.status === 'destroyed') {
    writeResponse(200, deployment.liveLog, response);
    return;
  }

  const server = await postgres.getOne(db, 'SELECT * FROM "servers" WHERE "hostname" = $1', [deployment.dockerHost]);

  https.request(`https://${server.hostname}:${server.apiPort}/internal/deployments/${deployment.id}/livelog`, {
    headers: {
      host: config.domains.api[0],
      'x-internal-secret': config.internalSecret
    }
  }, function (liveLogResponse) {
    liveLogResponse.pipe(response);
  }).end();
}

module.exports = logDeployment;
