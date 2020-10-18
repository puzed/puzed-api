async function listdomains ({ db }, userId) {
  const links = await db.getAll('domains', {
    query: {
      $or: [
        { userId: userId },
        { userId: { $null: true } }
      ]
    }
  });

  return links;
}

module.exports = listdomains;
