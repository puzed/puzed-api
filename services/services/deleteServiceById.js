async function getServiceById ({ db }, userId, serviceId) {
  const deployment = await db.getOne(`
    DELETE FROM "services" WHERE "userId" = $1 AND "id" = $2
  `, [userId, serviceId]);

  return deployment;
}

module.exports = getServiceById;
