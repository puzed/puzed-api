const pickRandomServer = require('./pickRandomServer');

async function createNewInstance (scope, deploymentId) {
  const { db } = scope;
  const server = await pickRandomServer(scope);

  const deployment = await db.getOne('deployments', { query: { id: deploymentId } });

  const instance = await db.post('instances', {
    serviceId: deployment.serviceId,
    deploymentId: deployment.id,
    serverId: server.id,
    commitHash: deployment.commitHash,
    status: 'queued',
    destroyed: false,
    dateCreated: Date.now()
  });

  return instance;
}

module.exports = createNewInstance;
