const performInstance = require('../../../common/performInstance');

async function checkInstances (scope, request, response, tokens) {
  performInstance(scope, tokens.instanceId);
  response.writeHead('200');
  response.end();
}

module.exports = checkInstances;
