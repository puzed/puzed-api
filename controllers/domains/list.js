const writeResponse = require('write-response');

const listDomains = require('../../queries/domains/listDomains');
const authenticate = require('../../common/authenticate');
const presentDomain = require('../../presenters/domain');

async function listDomainsRoute (scope, request, response) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const domains = await listDomains(scope, user.id);

  writeResponse(200, domains.map(presentDomain), response);
}

module.exports = listDomainsRoute;
