const https = require('https');

const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');
const checkRelationalData = require('../../../../common/checkRelationalData');

async function logInstance ({ db, settings, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const { instance } = await checkRelationalData(db, {
    service: {
      id: tokens.serviceId,
      userId: user.id
    },
    deployment: {
      id: tokens.deploymentId
    },
    instance: {
      id: tokens.instanceId
    }
  });

  const server = await db.getOne('servers', {
    query: {
      id: instance.serverId
    }
  });

  if (['building', 'starting'].includes(instance.status)) {
    https.request(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}/buildlog`, {
      headers: {
        host: settings.domains.api[0],
        'x-internal-secret': settings.secret
      }
    }, function (liveLogResponse) {
      liveLogResponse.pipe(response);
    }).end();
    return;
  }

  writeResponse(200, instance.buildLog, response);
}

module.exports = logInstance;
