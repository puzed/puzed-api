const writeResponse = require('write-response');
const axios = require('axios');
const generateAccessToken = require('./generateAccessToken');
const authenticate = require('../../common/authenticate');

async function githubListRepositoriesHandler (scope, request, response) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const { githubInstallationId } = await scope.db.getOne(`
    SELECT "githubInstallationId" FROM "githubUserLinks" WHERE "userId" = $1
  `, [user.id]);

  const accessToken = await generateAccessToken(scope, githubInstallationId);

  const repositories = await axios({
    url: 'https://api.github.com/installation/repositories',
    headers: {
      authorization: 'token ' + accessToken
    }
  });

  writeResponse(200, repositories.data.repositories, response);
}

module.exports = githubListRepositoriesHandler;
