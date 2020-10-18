async function listServices ({ db }, userId) {
  const services = await db.getAll('services', {
    query: {
      userId: userId
    }
  });

  return services;
}

module.exports = listServices;
