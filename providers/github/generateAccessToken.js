const axios = require('axios');
const { promisify } = require('util');

const getGithubConfig = require('./getGithubConfig');

const jwt = {
  sign: promisify(require('jsonwebtoken').sign)
};

async function generateAccessToken (scope, installationId) {
  const githubConfig = await getGithubConfig(scope);

  const appToken = await jwt.sign({
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 1),
    iss: githubConfig.appId
  }, githubConfig.clientKey, { algorithm: 'RS256' });

  const installationTokenResponse = await axios({
    url: `https://api.github.com/app/installations/${installationId}/access_tokens`,
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + appToken,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  return installationTokenResponse.data.token;
}

module.exports = generateAccessToken;
