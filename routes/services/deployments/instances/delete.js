const axios = require('axios');

const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function deleteInstance ({ db, settings, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const instance = await db.getOne(`
    SELECT "instances".*, "hostname"
      FROM "instances"
 LEFT JOIN "servers" ON "servers"."id" = "instances"."serverId"
 LEFT JOIN "services" ON "instances"."serviceId" = "services"."id"
     WHERE "userId" = $1 AND "serviceId" = $2 AND "instances"."id" = $3
 `, [user.id, tokens.serviceId, tokens.instanceId]);

  if (!instance) {
    throw Object.assign(new Error('instance not found'), { statusCode: 404 });
  }

  const server = await db.getOne('SELECT * FROM "servers" WHERE "hostname" = $1', [instance.hostname]);
  await axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}`, {
    method: 'DELETE',
    headers: {
      host: settings.domains.api[0],
      'x-internal-secret': settings.internalSecret
    }
  });

  writeResponse(200, '', response);
}

module.exports = deleteInstance;
