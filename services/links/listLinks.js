async function listLinks ({ db }, userId, serviceId) {
  const links = await db.getAll(`
       SELECT "links".*
         FROM "links"
    LEFT JOIN "providers" ON "providers"."id" = "links"."providerId"
    WHERE "links"."userId" = $1
  `, [userId]);

  return links;
}

module.exports = listLinks;
