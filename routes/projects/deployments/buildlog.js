const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function logDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await postgres.getOne(db, `
    SELECT "deployments"."buildLog"
      FROM "deployments"
 LEFT JOIN "projects" ON "deployments"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2 AND "deployments"."id" = $3
  `, [user.id, tokens.projectId, tokens.deploymentId]);

  writeResponse(200, deployment.buildLog, response);
}

module.exports = logDeployment;
