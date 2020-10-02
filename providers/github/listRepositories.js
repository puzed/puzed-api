const axios = require('axios');
const generateAccessToken = require('./generateAccessToken');

async function listRepositories (scope, userId, linkId) {
  const { db } = scope;

  const link = await db.getOne(`
    SELECT * FROM "links" WHERE "userId" = $1 AND "id" = $2
  `, [userId, linkId]);

  if (!link) {
    throw Object.assign(new Error('no link'), { statusCode: 404 });
  }

  const accessToken = await generateAccessToken(scope, link.config.installationId);

  const repositories = await axios({
    url: 'https://api.github.com/installation/repositories',
    headers: {
      authorization: 'token ' + accessToken
    }
  });

  return repositories.data.repositories;
}

module.exports = listRepositories;
