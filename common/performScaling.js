const hint = require('hinton');
const createNewInstance = require('./createNewInstance');

async function deploymentScaling (scope) {
  const { db, notify, config } = scope;
  const deployments = await db.getAll('deployments', {
    query: {
      guardianServerId: config.serverId,
      destroyed: {
        $ne: true
      }
    },
    fields: []
  });

  for (const deployment of deployments) {
    const healthyInstances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id,
        status: {
          $in: ['starting', 'building', 'healthy']
        }
      },
      fields: ['status']
    });
    const totalHealthyInstances = healthyInstances.length;
    const scaling = deployment.scaling || {};
    const minInstances = isNaN(scaling.minInstances) ? 1 : scaling.minInstances;

    if (minInstances > totalHealthyInstances) {
      await createNewInstance(scope, deployment.id);
      notify.broadcast(deployment.id);
    }
  }
}

module.exports = async function (scope) {
  hint('puzed.scaling', 'starting scaling batch');
  deploymentScaling(scope);
};
