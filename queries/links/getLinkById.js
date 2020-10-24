async function getLinkById ({ db }, userId, linkId) {
  const link = await db.getOne('links', {
    query: {
      $or: [
        { userId },
        { userId: { $null: true } }
      ],
      id: linkId
    }
  });

  return link;
}

module.exports = getLinkById;
