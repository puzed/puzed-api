async function listServices ({ db }, userId) {
  const services = await db.getAll(`
    SELECT * FROM "services" WHERE "userId" = $1
  `, [userId]);

  return services;
}

module.exports = listServices;
