const writeResponse = require('write-response');
const axios = require('axios');

const createSession = require('../../services/sessions/createSession');
const getGithubConfig = require('./getGithubConfig');

async function providerOauthRoute (scope, request, response) {
  const { db } = scope;

  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  const githubConfig = await getGithubConfig(scope);

  try {
    const oauthResponse = await axios({
      method: 'post',
      url: `https://github.com/login/oauth/access_token?client_id=${githubConfig.clientId}&client_secret=${githubConfig.clientSecret}&code=${token}`,
      headers: {
        accept: 'application/json'
      },
      data: JSON.stringify({
        scope: 'repo'
      })
    });

    if (oauthResponse.data.error) {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(oauthResponse.data));
      return;
    }

    const githubUser = await axios({
      url: 'https://api.github.com/user',
      headers: {
        authorization: 'token ' + oauthResponse.data.access_token
      }
    });

    const githubUserLink = await db.getOne(`
      SELECT *
        FROM "githubUserLinks"
      WHERE "githubUsername" = $1
    `, [githubUser.data.login]);

    if (!githubUserLink) {
      throw new Error('oauth failed');
    }

    const session = await createSession(scope, githubUserLink.userId);

    writeResponse(200, session, response);
  } catch (error) {
    console.log(error);
    throw new Error('oauth failed');
  }
}

module.exports = providerOauthRoute;
