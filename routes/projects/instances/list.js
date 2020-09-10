const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function listInstances ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const instances = await postgres.getAll(db, `
    SELECT
      "instances"."id" as id,
      "instances"."projectId",
      "instances"."status",
      "instances"."commitHash",
      "instances"."branch",
      "instances"."group",
      "instances"."dateCreated"
      FROM "instances"
 LEFT JOIN "projects" ON "instances"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2
  ORDER BY "dateCreated" DESC
  `, [user.id, tokens.projectId]);

  writeResponse(200, instances, response);
}

module.exports = listInstances;
