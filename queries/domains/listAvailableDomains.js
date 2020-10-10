async function listAvailableDomains ({ db }, userId) {
  const links = await db.getAll(`
       SELECT "domains".*
         FROM "domains"
        WHERE 
          ("domains"."userId" = $1 OR "domains"."userId" IS NULL)
          AND
          ("verificationStatus" = 'success')
  `, [userId]);

  return links;
}

module.exports = listAvailableDomains;
