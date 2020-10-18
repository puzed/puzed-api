async function listNetworkRules ({ db }, userId) {
  const networkRules = await db.getAll('networkRules', {
    query: {
      $or: [{
        userId: userId
      }, {
        userId: { $null: true }
      }]
    }
  });

  return networkRules;
}

module.exports = listNetworkRules;
