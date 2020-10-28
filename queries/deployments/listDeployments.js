async function listDeployments ({ db }, userId, serviceId) {
  const service = await db.getOne('services', {
    query: {
      id: serviceId,
      userId
    }
  });

  if (!service) {
    throw Object.assign(new Error('service not found'), { statusCode: 404 });
  }

  const deployments = await db.getAll('deployments', {
    query: {
      serviceId: serviceId
    }
  });

  const promises = await deployments.map(async deployment => {
    const instances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id
      },
      fields: ['status']
    });

    deployment.totalInstances = instances.filter(instance => !['destroyed', 'failed'].includes(instance.status)).length;
    deployment.healthyInstances = instances.filter(instance => ['healthy'].includes(instance.status)).length;

    return deployment;
  });

  return Promise.all(promises);
}

module.exports = listDeployments;
