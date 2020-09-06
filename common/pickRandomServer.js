const postgres = require('postgres-fp/promises');

async function pickRandomServer ({ db }) {
  return postgres.getOne(db, `
    SELECT *
      FROM "servers"
  ORDER BY random()
     LIMIT 1
  `);
}

module.exports = pickRandomServer;
