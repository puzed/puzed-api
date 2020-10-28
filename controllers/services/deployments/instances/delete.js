const axios = require('axios');
const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');
const checkRelationalData = require('../../../../common/checkRelationalData');

async function deleteInstance ({ db, settings, config }, request, response, tokens) {
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

  const url = new URL(request.url, 'http://localhost');

  const hard = url.searchParams.get('hard') ? '?hard=true' : '';
  await axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}${hard}`, {
    method: 'DELETE',
    headers: {
      host: settings.domains.api[0],
      'x-internal-secret': settings.secret
    }
  });

  writeResponse(200, '', response);
}

module.exports = deleteInstance;
