async function getLinkById ({ db }, userId, linkId) {
  const link = await db.getOne(`
    SELECT * FROM "links" WHERE "userId" = $1 AND "id" = $2
  `, [userId, linkId]);

  return link;
}

module.exports = getLinkById;
