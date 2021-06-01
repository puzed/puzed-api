const hint = require('hinton');
const deployInstance = require('../common/deployInstance');

async function deployInstances (scope) {
  const { db, config } = scope;
  const instances = await db.getAll('instances', {
    query: {
      serverId: config.serverId,
      status: 'queued'
    },
    fields: ['status', 'deploymentId']
  });

  const promises = instances.map(async instance => {
    const deployment = await db.getOne('deployments', {
      query: {
        id: instance.deploymentId
      },
      fields: ['status', 'buildStatus']
    });

    if (deployment && deployment.buildStatus === 'success') {
      deployInstance(scope, instance.id);
    }
  });

  return Promise.all(promises);
}

module.exports = async function (scope) {
  hint('puzed.deployInstances', 'starting deploy instances batch');
  return deployInstances(scope);
};
