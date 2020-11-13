async function getInstanceAndRelated ({ db, providers }, instanceId) {
  const instance = await db.getOne('instances', {
    query: {
      id: instanceId
    }
  });

  const deployment = await db.getOne('deployments', {
    query: {
      id: instance.deploymentId
    }
  });

  const service = await db.getOne('services', {
    query: {
      id: deployment.serviceId
    }
  });

  const link = await db.getOne('links', {
    query: {
      id: service.linkId
    }
  });

  const provider = providers[link.providerId];

  return {
    instance,
    deployment,
    service,
    link,
    provider
  };
}

module.exports = getInstanceAndRelated;
