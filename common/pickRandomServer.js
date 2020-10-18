const selectRandomItemFromArray = require('./selectRandomItemFromArray');

async function pickRandomServer ({ db }) {
  const servers = await db.getAll('servers');
  return selectRandomItemFromArray(servers);
}

module.exports = pickRandomServer;
