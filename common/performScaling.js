const axios = require('axios');
const hint = require('hinton');
const createNewInstance = require('./createNewInstance');

async function deploymentScaling (scope) {
  const { db, config } = scope;
  const deployments = await db.getAll('deployments', {
    query: {
      guardianServerId: config.serverId,
      status: {
        $nin: ['destroyed']
      }
    },
    fields: ['stable']
  });

  for (const deployment of deployments) {
    const healthyInstances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id,
        status: {
          $in: ['starting', 'building', 'healthy']
        }
      },
      fields: ['status', 'scaling', 'serviceId', 'commitHash']
    });
    const totalHealthyInstances = healthyInstances.length;
    const scaling = deployment.scaling || {};
    const minInstances = isNaN(scaling.minInstances) ? 1 : scaling.minInstances;

    if (minInstances > totalHealthyInstances) {
      await createNewInstance(scope, deployment);
    }
  }
}

module.exports = async function (scope) {
  hint('puzed.scaling', 'starting scaling batch');
  deploymentScaling(scope);
};
