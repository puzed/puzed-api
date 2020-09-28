const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function readInstance ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const instance = await db.getOne(`
    SELECT
      "instances"."id" as id,
      "instances"."projectId",
      "instances"."deploymentId",
      "instances"."status",
      "instances"."commitHash",
      "instances"."branch",
      "instances"."dateCreated"
     FROM "instances"
LEFT JOIN "projects" ON "instances"."projectId" = "projects"."id"
    WHERE "userId" = $1
      AND "projectId" = $2
      AND "instances"."id" = $3
 ORDER BY "dateCreated" DESC
  `, [user.id, tokens.projectId, tokens.instanceId]);

  if (!instance) {
    throw Object.assign(new Error('instance not found'), { statusCode: 404 });
  }

  writeResponse(200, {
    ...instance
  }, response);
}

module.exports = readInstance;
