const writeResponse = require('write-response');
const axios = require('axios');
const generateAccessToken = require('./generateAccessToken');
const authenticate = require('../../common/authenticate');

async function listRepositoriesHandler (scope, request, response, tokens) {
  const { db } = scope;

  const { user } = await authenticate(scope, request.headers.authorization);

  const link = await db.getOne(`
    SELECT * FROM "links" WHERE "providerId" = $1 AND "userId" = $2
  `, ['github', user.id]);

  const accessToken = await generateAccessToken(scope, link.config.installationId);

  const branches = await axios({
    url: `https://api.github.com/repos/${tokens.owner}/${tokens.repo}/branches`,
    headers: {
      authorization: 'token ' + accessToken
    }
  });

  writeResponse(200, branches.data, response);
}

module.exports = listRepositoriesHandler;
