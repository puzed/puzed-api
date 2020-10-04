const writeResponse = require('write-response');
const axios = require('axios');
const uuidv4 = require('uuid').v4;

const buildInsertStatement = require('../../common/buildInsertStatement');
const createSession = require('../../services/sessions/createSession');
const getGithubConfig = require('./getGithubConfig');

function createLink ({ db }, user, githubUser, url) {
  const linkId = uuidv4();
  const statement = buildInsertStatement('links', {
    id: linkId,
    providerId: 'github',
    userId: user.id,
    externalUserId: githubUser.data.login,
    config: JSON.stringify({
      installationId: url.searchParams.get('installationId')
    }),
    dateCreated: Date.now()
  });
  return db.run(statement.sql, statement.parameters);
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

    const githubEmail = await axios({
      url: 'https://api.github.com/user/emails',
      headers: {
        authorization: 'token ' + oauthResponse.data.access_token
      }
    });

    const githubPrimaryEmail = githubEmail.data.find(email => email.primary);

    const githubUserLink = await db.getOne(`
      SELECT *
        FROM "links"
      WHERE "externalUserId" = $1
      LIMIT 1
    `, [githubUser.data.login]);

    const user = await db.getOne(`
      SELECT *
        FROM "users"
      WHERE "email" = $1
      LIMIT 1
    `, [githubPrimaryEmail.email]);

    if (!user) {
      const userId = uuidv4();
      const statement = buildInsertStatement('users', {
        id: userId,
        email: githubPrimaryEmail.email,
        dateCreated: Date.now()
      });
      await db.run(statement.sql, statement.parameters);

      const session = await createSession(scope, userId);
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
