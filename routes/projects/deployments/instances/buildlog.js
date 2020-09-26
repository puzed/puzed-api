const https = require('https');

const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function logInstance ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const instance = await db.getOne(`
    SELECT "instances".*
      FROM "instances"
 LEFT JOIN "projects" ON "instances"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2 AND "instances"."id" = $3
  `, [user.id, tokens.projectId, tokens.instanceId]);

  if (!instance) {
    writeResponse(404, { error: 'not found' }, response);
    return;
  }

  const server = await db.getOne('SELECT * FROM "servers" WHERE "hostname" = $1', [instance.dockerHost]);
  if (['building', 'starting'].includes(instance.status)) {
    https.request(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}/buildlog`, {
      headers: {
        host: config.domains.api[0],
        'x-internal-secret': config.internalSecret
      }
    }, function (liveLogResponse) {
      liveLogResponse.pipe(response);
    }).end();
    return;
  }

  writeResponse(200, instance.buildLog, response);
}

module.exports = logInstance;
