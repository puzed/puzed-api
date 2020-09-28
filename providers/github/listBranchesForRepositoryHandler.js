const writeResponse = require('write-response');
const axios = require('axios');
const generateAccessToken = require('./generateAccessToken');
const authenticate = require('../../common/authenticate');

async function listRepositoriesHandler (scope, request, response, tokens) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const { githubInstallationId } = await scope.db.getOne(`
    SELECT "githubInstallationId" FROM "githubUserLinks" WHERE "userId" = $1
  `, [user.id]);

  const accessToken = await generateAccessToken(scope, githubInstallationId);

  const branches = await axios({
    url: `https://api.github.com/repos/${tokens.owner}/${tokens.repo}/branches`,
    headers: {
      authorization: 'token ' + accessToken
    }
  });

  writeResponse(200, branches.data, response);
}

module.exports = listRepositoriesHandler;
