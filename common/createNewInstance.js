const axios = require('axios');
const pickRandomServer = require('./pickRandomServer');

async function createNewInstance (scope, deploymentId) {
  const { db, settings } = scope;
  const server = await pickRandomServer(scope);

  const deployment = await db.getOne('deployments', { query: { id: deploymentId } });

  const instance = await db.post('instances', {
    serviceId: deployment.serviceId,
    deploymentId: deployment.id,
    serverId: server.id,
    commitHash: deployment.commitHash,
    status: 'queued',
    dateCreated: Date.now()
  });

  await axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}`, {
    method: 'POST',
    headers: {
      host: settings.domains.api[0],
      'x-internal-secret': settings.secret
    }
  });

  return instance;
}

module.exports = createNewInstance;
