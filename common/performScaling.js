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
    fields: ['scaling']
  });

  const promises = deployments.map(async deployment => {
    const healthyInstances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id,
        status: {
          $in: ['queued', 'building', 'starting', 'healthy']
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
  });

  return Promise.all(promises);
}

module.exports = async function (scope) {
  hint('puzed.scaling', 'starting scaling batch');
  return deploymentScaling(scope);
};
