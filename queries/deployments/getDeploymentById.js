const checkRelationalData = require('../../common/checkRelationalData');

async function getDeploymentById ({ db }, userId, serviceId, deploymentId) {
  const { deployment } = await checkRelationalData(db, {
    service: {
      id: serviceId,
      userId
    },
    deployment: {
      id: deploymentId
    }
  });

  const instances = await db.getAll('instances', {
    query: {
      deploymentId
    }
  });

  const totalInstances = instances.length;
  const healthyInstances = instances.filter(instance => ['healthy', 'destroyed'].includes(instance.status)).length;

  return {
    ...deployment,
    totalInstances,
    healthyInstances
  };
}

module.exports = getDeploymentById;
