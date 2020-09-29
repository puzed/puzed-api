const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function listInstances ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const instances = await db.getAll(`
    SELECT
      "instances"."id" as id,
      "instances"."serviceId",
      "instances"."deploymentId",
      "instances"."status",
      "instances"."commitHash",
      "instances"."branch",
      "instances"."dateCreated"
      FROM "instances"
 LEFT JOIN "services" ON "instances"."serviceId" = "services"."id"
     WHERE "userId" = $1 AND "serviceId" = $2 AND "instances"."deploymentId" = $3
  ORDER BY "dateCreated" DESC
  `, [user.id, tokens.serviceId, tokens.deploymentId]);

  writeResponse(200, instances, response);
}

module.exports = listInstances;
