async function listServices ({ db }, userId) {
  const services = await db.getAll('services', {
    query: {
      userId: userId
    },
    order: 'desc(dateCreated)'
  });

  return services;
}

module.exports = listServices;
