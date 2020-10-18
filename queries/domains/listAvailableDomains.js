async function listAvailableDomains ({ db }, userId) {
  const links = await db.getAll('domains', {
    query: {
      $or: [
        { userId: userId },
        { userId: { $null: true } }
      ],
      verificationStatus: 'success'
    }
  });

  return links;
}

module.exports = listAvailableDomains;
