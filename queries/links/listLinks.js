async function listLinks ({ db }, userId, serviceId) {
  const links = await db.getAll('links', {
    query: {
      userId: userId
    }
  });

  return links;
}

module.exports = listLinks;
