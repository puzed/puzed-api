const writeResponse = require('write-response');

const presentProvider = require('../../presenters/provider');

async function listProvidersRoute ({ db, config }, request, response, tokens) {
  const providers = await db.getAll(`
    SELECT *
      FROM "providers"
  `);

  writeResponse(200, providers.map(presentProvider), response);
}

module.exports = listProvidersRoute;
