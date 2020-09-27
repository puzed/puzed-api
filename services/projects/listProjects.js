async function listProjects ({ db }, userId) {
  const projects = await db.getAll(`
    SELECT * FROM "projects" WHERE "userId" = $1
  `, [userId]);

  return projects;
}

module.exports = listProjects;
