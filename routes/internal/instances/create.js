const deployInstance = require('../../../common/deployInstance');

async function checkInstances (scope, request, response, tokens) {
  deployInstance(scope, tokens.instanceId);
  response.writeHead('200');
  response.end();
}

module.exports = checkInstances;
