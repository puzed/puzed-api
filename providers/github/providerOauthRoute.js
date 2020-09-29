const writeResponse = require('write-response');
const axios = require('axios');
const uuidv4 = require('uuid').v4;

const buildInsertStatement = require('../../common/buildInsertStatement');
const authenticate = require('../../common/authenticate');
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
        FROM "links"
      WHERE "externalUserId" = $1
      LIMIT 1
    `, [githubUser.data.login]);

    // Fail: Brand new user
    if (!request.headers.authorization && !githubUserLink) {
      throw new Error('oauth failed');
    }

    // Create session: User and link exists
    if (!request.headers.authorization && githubUserLink) {
      const session = await createSession(scope, githubUserLink.userId);
      writeResponse(200, {
        session,
        actionTaken: 'sessionCreated'
      }, response);

      return;
    }

    // Create session: User and link exists
    if (request.headers.authorization && !githubUserLink) {
      const { user } = await authenticate(scope, request.headers.authorization);

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
      await db.run(statement.sql, statement.parameters);

      writeResponse(201, { id: linkId, actionTaken: 'linkCreated' }, response);
      return;
    }

    throw new Error('oauth failed');
  } catch (error) {
    console.log(error);
    throw new Error('oauth failed');
  }
}

module.exports = providerOauthRoute;
