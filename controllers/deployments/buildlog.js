const https = require('https');

const writeResponse = require('write-response');

const authenticate = require('../../common/authenticate');
const checkRelationalData = require('../../common/checkRelationalData');

async function buildlog ({ db, settings, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const { deployment } = await checkRelationalData(db, {
    service: {
      id: tokens.serviceId,
      userId: user.id
    },
    deployment: {
      id: tokens.deploymentId
    }
  });

  const server = await db.getOne('servers', {
    query: {
      id: deployment.guardianServerId
    }
  });

  if (!['failed', 'success'].includes(deployment.buildStatus)) {
    https.request(`https://${server.hostname}:${server.apiPort}/internal/deployments/${deployment.id}/buildlog`, {
      headers: {
        host: settings.domains.api[0],
        'x-internal-secret': settings.secret
      }
    }, function (liveLogResponse) {
      liveLogResponse.pipe(response);
    }).end();
    return;
  }

  writeResponse(200, deployment.buildLog, response);
}

module.exports = buildlog;
