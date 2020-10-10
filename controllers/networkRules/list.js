const writeResponse = require('write-response');

const listNetworkRules = require('../../queries/networkRules/listNetworkRules');
const authenticate = require('../../common/authenticate');
const presentNetworkRule = require('../../presenters/networkRule');

async function listNetworkRulesRoute (scope, request, response) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const networkRules = await listNetworkRules(scope, user.id);

  writeResponse(200, networkRules.map(presentNetworkRule), response);
}

module.exports = listNetworkRulesRoute;
