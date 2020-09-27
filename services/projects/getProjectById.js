async function getProjectById ({ db }, userId, projectId) {
  const deployment = await db.getOne(`
    SELECT * FROM "projects" WHERE "userId" = $1 AND "id" = $2
  `, [userId, projectId]);

  return deployment;
}

module.exports = getProjectById;
