const performDeployment = require('../../../common/performDeployment');

async function checkDeployments ({ db, config }, request, response, tokens) {
  performDeployment({ db, config }, tokens.deploymentId);
  response.writeHead('200');
  response.end();
}

module.exports = checkDeployments;
