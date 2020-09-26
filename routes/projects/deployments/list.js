const writeResponse = require('write-response');

const authenticate = require('../../../common/authenticate');

async function listDeployments ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployments = await db.getAll(`
    SELECT "deployments".*, 
          (
            SELECT count(*) 
              FROM "instances"
             WHERE "instances"."deploymentId" = "deployments"."id"
               AND "instances"."status" NOT IN ('destroyed')
          ) as "instanceCount"
      FROM "deployments"
LEFT JOIN "projects" ON "projects"."id" = "deployments"."projectId"
    WHERE "projects"."userId" = $1 AND "projects"."id" = $2
  ORDER BY "deployments"."dateCreated" ASC
  `, [user.id, tokens.projectId]);

  writeResponse(200, deployments, response);
}

module.exports = listDeployments;
