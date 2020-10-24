async function getNetworkRulesById ({ db }, userId, id) {
  const link = await db.getOne('networkRules', {
    query: {
      id,
      userId
    }
  });

  return link;
}

module.exports = getNetworkRulesById;
