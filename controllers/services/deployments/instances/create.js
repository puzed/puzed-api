const axios = require('axios');
const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');
const pickRandomServer = require('../../../../common/pickRandomServer');
const checkRelationalData = require('../../../../common/checkRelationalData');

async function createInstance ({ db, settings, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const { service, deployment } = await checkRelationalData(db, {
    service: {
      id: tokens.serviceId,
      userId: user.id
    },
    deployment: {
      id: tokens.deploymentId
    }
  });

  const server = await pickRandomServer({ db });

  const instance = await db.post('instances', {
    serviceId: service.id,
    deploymentId: deployment.id,
    serverId: server.id,
    commitHash: deployment.commitHash,
    status: 'queued',
    dateCreated: Date.now()
  });

  axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}`, {
    method: 'POST',
    headers: {
      host: settings.domains.api[0],
      'x-internal-secret': settings.secret
    }
  });

  writeResponse(200, instance, response);
}

module.exports = createInstance;
