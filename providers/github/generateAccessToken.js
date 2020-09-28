const axios = require('axios');
const { promisify } = require('util');

const jwt = {
  sign: promisify(require('jsonwebtoken').sign)
};

async function generateAccessToken ({ db, config }, installationId) {
  const appToken = await jwt.sign({
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 1),
    iss: config.githubAppId
  }, config.githubClientKey, { algorithm: 'RS256' });

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
