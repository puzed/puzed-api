const writeResponse = require('write-response');

const getUserById = require('../../queries/users/getUserById');
const presentUser = require('../../presenters/user');

async function readSession (scope, request, response, tokens) {
  const session = await scope.db.getOne('sessions', {
    query: {
      secret: request.headers.authorization
    }
  });

  if (!session) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  session.user = await getUserById(scope, session.userId);

  session.user = presentUser(session.user);

  writeResponse(200, session, response);
}

module.exports = readSession;
