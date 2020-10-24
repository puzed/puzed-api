async function getNetworkRulesById ({ db }, userId, linkId) {
  const link = await db.getOne('networkRules', {
    query: {
      id: linkId,
      userId
    }
  });

  return link;
}

module.exports = getNetworkRulesById;
