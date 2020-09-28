const axios = require('axios');

const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function deleteInstance ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const instance = await db.getOne(`
    SELECT "instances".*
      FROM "instances"
 LEFT JOIN "projects" ON "instances"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2 AND "instances"."id" = $3
 `, [user.id, tokens.projectId, tokens.instanceId]);

  if (!instance) {
    throw Object.assign(new Error('instance not found'), { statusCode: 404 });
  }

  const server = await db.getOne('SELECT * FROM "servers" WHERE "hostname" = $1', [instance.dockerHost]);
  await axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}`, {
    method: 'DELETE',
    headers: {
      host: config.domains.api[0],
      'x-internal-secret': config.internalSecret
    }
  });

  writeResponse(200, '', response);
}

module.exports = deleteInstance;
