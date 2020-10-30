async function getServiceById ({ db }, userId, serviceId, withDeployments) {
  const service = await db.getOne('services', {
    query: {
      userId: userId,
      id: serviceId
    }
  });

  if (withDeployments) {
    const deployments = await db.getAll('deployments', {
      query: {
        serviceId: service.id
      }
    });

    return {
      ...service,
      deployments
    };
  }

  return service;
}

module.exports = getServiceById;
