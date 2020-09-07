const performDeployment = require('../../../common/performDeployment');

async function checkDeployments (scope, request, response, tokens) {
  performDeployment(scope, tokens.deploymentId);
  response.writeHead('200');
  response.end();
}

module.exports = checkDeployments;
