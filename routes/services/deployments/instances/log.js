const https = require('https');

const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function logInstance ({ db, settings, config }, request, response, tokens) {
  request.setTimeout(60 * 60 * 1000);
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const instance = await db.getOne(`
    SELECT "instances".*, "hostname"
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

  if (instance.status === 'destroyed') {
    writeResponse(200, instance.liveLog, response);
    return;
  }

  const server = await db.getOne('SELECT * FROM "servers" WHERE "hostname" = $1', [instance.hostname]);

  https.request(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}/livelog`, {
    headers: {
      host: settings.domains.api[0],
      'x-internal-secret': settings.internalSecret
    }
  }, function (liveLogResponse) {
    liveLogResponse.pipe(response);
  }).end();
}

module.exports = logInstance;
