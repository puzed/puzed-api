async function getLinkById ({ db }, userId, linkId) {
  const link = await db.getOne('links', {
    query: {
      userId: userId,
      id: linkId
    }
  });

  return link;
}

module.exports = getLinkById;
