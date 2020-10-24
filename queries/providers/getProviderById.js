async function getProviderById ({ db }, linkId) {
  const link = await db.getOne('providers', {
    query: {
      id: linkId
    }
  });

  return link;
}

module.exports = getProviderById;
