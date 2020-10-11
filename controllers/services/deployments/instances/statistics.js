const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function statisticsRoute ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const instance = await db.getOne(`
    SELECT "instances".*
      FROM "instances"
 LEFT JOIN "servers" ON "servers"."id" = "instances"."serverId"
 LEFT JOIN "services" ON "instances"."serviceId" = "services"."id"
 LEFT JOIN "deployments" ON "instances"."deploymentId" = "deployments"."id"
     WHERE "userId" = $1
       AND "instances"."serviceId" = $2
       AND "instances"."deploymentId" = $3
       AND "instances"."id" = $4
  `, [user.id, tokens.serviceId, tokens.deploymentId, tokens.instanceId]);

  if (!instance) {
    throw Object.assign(new Error('instance not found'), { statusCode: 404 });
  }

  const millisecondsInAnHour = 3600000;

  const statistics = await db.getAll(`
    SELECT
      "cpu",
      "cpuPercent",
      "memory",
      "diskIo",
      "dateCreated"
     FROM "instanceStatistics"
    WHERE "instanceId" = $1
      AND "dateCreated" > $2
 ORDER BY "dateCreated" ASC
  `, [tokens.instanceId, Date.now() - millisecondsInAnHour]);

  writeResponse(200, statistics, response);
}

module.exports = statisticsRoute;
