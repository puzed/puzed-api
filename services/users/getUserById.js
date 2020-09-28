async function getUserById ({ db }, userId) {
  const deployment = await db.getOne(`
    SELECT * FROM "users" WHERE "id" = $1
  `, [userId]);

  return deployment;
}

module.exports = getUserById;
