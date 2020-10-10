async function listNetworkRules ({ db }, userId) {
  const networkRules = await db.getAll(`
       SELECT *
         FROM "networkRules"
        WHERE "userId" = $1
           OR "userId" IS NULL
  `, [userId]);

  return networkRules;
}

module.exports = listNetworkRules;
