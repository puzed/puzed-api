const writeResponse = require('write-response');

const listLinks = require('../../services/links/listLinks');
const authenticate = require('../../common/authenticate');
const presentLink = require('../../presenters/link');

async function listLinksRoute (scope, request, response) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const links = await listLinks(scope, user.id);

  writeResponse(200, links.map(presentLink), response);
}

module.exports = listLinksRoute;
