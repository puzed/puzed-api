async function pickRandomServer ({ db }) {
  return db.getOne(`
    SELECT *
      FROM "servers"
  ORDER BY random()
     LIMIT 1
  `);
}

module.exports = pickRandomServer;
