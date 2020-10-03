async function listdomains ({ db }, userId) {
  const links = await db.getAll(`
       SELECT "domains".*
         FROM "domains"
        WHERE "domains"."userId" = $1
           OR "domains"."userId" IS NULL
  `, [userId]);

  return links;
}

module.exports = listdomains;
