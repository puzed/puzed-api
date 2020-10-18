async function getServiceById ({ db }, userId, serviceId) {
  const deployment = await db.getOne('services', {
    query: {
      userId: userId,
      id: serviceId
    }
  });

  return deployment;
}

module.exports = getServiceById;
