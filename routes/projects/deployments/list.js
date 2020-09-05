const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function listDeployments ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployments = await postgres.getAll(db, `
    SELECT
      "deployments"."id" as id,
      "deployments"."projectId",
      "deployments"."status",
      "deployments"."dateCreated"
      FROM "deployments"
 LEFT JOIN "projects" ON "deployments"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2
  `, [user.id, tokens.projectId]);

  writeResponse(200, deployments, response);
}

module.exports = listDeployments;
