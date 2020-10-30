async function listServices ({ db }, userId, withDeployments) {
  const services = await db.getAll('services', {
    query: {
      userId: userId
    },
    order: 'desc(dateCreated)'
  });

  if (withDeployments) {
    const servicesWithDeployments = await Promise.all(
      services.map(async service => {
        const deployments = await db.getAll('deployments', {
          query: {
            serviceId: service.id
          }
        });

        return {
          ...service,
          deployments
        };
      })
    );

    return servicesWithDeployments;
  }

  return services;
}

module.exports = listServices;
