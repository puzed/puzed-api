const hint = require('hinton');
const createNewInstance = require('../common/createNewInstance');

async function deploymentScaling (scope) {
  const { db, notify, config } = scope;
  const deployments = await db.getAll('deployments', {
    query: {
      guardianServerId: config.serverId,
      destroyed: false
    },
    fields: ['scaling']
  });

  const promises = deployments.map(async deployment => {
    const instances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id
      },
      order: ['desc(dateCreated)'],
      fields: ['status', 'dateCreated']
    });
    const totalHealthyInstances = instances
      .filter(instance => ['queued', 'building', 'starting', 'healthy'].includes(instance.status)).length;

    const scaling = deployment.scaling || {};
    const minInstances = isNaN(scaling.minInstances) ? 1 : scaling.minInstances;

    const failedInstancesCreatedLastMinute = instances.filter(instance => {
      return instance.status === 'failed' && Date.now() - instance.dateCreated < 120000;
    });

    if (failedInstancesCreatedLastMinute.length < 3 && minInstances > totalHealthyInstances) {
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
