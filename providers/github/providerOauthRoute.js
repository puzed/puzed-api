const writeResponse = require('write-response');
const axios = require('axios');

const createSession = require('../../queries/sessions/createSession');
const getGithubConfig = require('./getGithubConfig');

function createLink ({ db }, user, githubUser, url) {
  return db.post('links', {
    providerId: 'github',
    userId: user.id,
    externalUserId: githubUser.data.login,
    config: {
      installationId: url.searchParams.get('installationId')
    },
    dateCreated: Date.now()
  });
}

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
      data: {
        scope: 'repo'
      }
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

    const githubEmail = await axios({
      url: 'https://api.github.com/user/emails',
      headers: {
        authorization: 'token ' + oauthResponse.data.access_token
      }
    });

    const githubPrimaryEmail = githubEmail.data.find(email => email.primary);

    const githubUserLink = await db.getOne('links', {
      query: {
        externalUserId: githubUser.data.login
      }
    });

    const user = await db.getOne('users', {
      query: {
        email: githubPrimaryEmail.email || null
      }
    });

    if (!user) {
      const user = await db.post('users', {
        email: githubPrimaryEmail.email,
        dateCreated: Date.now()
      });

      const session = await createSession(scope, user.id);
      writeResponse(200, {
        session,
        actionTaken: 'sessionCreated'
      }, response);

      return;
    }

    // Create session: User and link exists
    if (!request.headers.authorization && user) {
      const session = await createSession(scope, user.id);
      writeResponse(200, {
        session,
        actionTaken: 'sessionCreated'
      }, response);

      return;
    }

    // Create session: User and link exists
    if (request.headers.authorization && !githubUserLink) {
      const link = await createLink({ db }, user, githubUser, url);
      writeResponse(201, { id: link.id, actionTaken: 'linkCreated' }, response);
      return;
    }

    throw new Error('oauth failed');
  } catch (error) {
    console.log(error);
    throw new Error('oauth failed');
  }
}

module.exports = providerOauthRoute;
