async function getNetworkRulesById ({ db }, userId, id) {
  const link = await db.getOne('networkRules', {
    query: {
      id,
      $or: [
        { userId },
        { userId: { $null: true } }
      ]
    }
  });

  return link;
}

module.exports = getNetworkRulesById;
