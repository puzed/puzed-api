async function getDeploymentAndRelated ({ db, providers }, deploymentId) {
  const deployment = await db.getOne('deployments', {
    query: {
      id: deploymentId
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
    deployment,
    service,
    link,
    provider
  };
}

module.exports = getDeploymentAndRelated;
