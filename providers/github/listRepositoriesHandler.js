const writeResponse = require('write-response');
const axios = require('axios');
const generateAccessToken = require('./generateAccessToken');
const authenticate = require('../../common/authenticate');

async function listRepositoriesHandler (scope, request, response) {
  const { db } = scope;

  const { user } = await authenticate(scope, request.headers.authorization);

  const link = await db.getOne(`
    SELECT * FROM "links" WHERE "providerId" = $1 AND "userId" = $2
  `, ['github', user.id]);

  const accessToken = await generateAccessToken(scope, link.config.installationId);

  const repositories = await axios({
    url: 'https://api.github.com/installation/repositories',
    headers: {
      authorization: 'token ' + accessToken
    }
  });

  writeResponse(200, repositories.data.repositories, response);
}

module.exports = listRepositoriesHandler;
