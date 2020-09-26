const writeResponse = require('write-response');

const authenticate = require('../../../common/authenticate');

async function readDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await db.getOne(`
  SELECT "deployments".*, 
  (SELECT count(*) FROM "instances" WHERE "instances"."deploymentId" = "deployments"."id") as "instanceCount"
     FROM "deployments"
LEFT JOIN "projects" ON "deployments"."projectId" = "projects"."id"
    WHERE "userId" = $1
      AND "projectId" = $2
      AND "deployments"."id" = $3
 ORDER BY "dateCreated" DESC
  `, [user.id, tokens.projectId, tokens.deploymentId]);

  if (!deployment) {
    throw Object.assign(new Error('deployment not found'), { statusCode: 404 });
  }

  writeResponse(200, {
    ...deployment
  }, response);
}

module.exports = readDeployment;
