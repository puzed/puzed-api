const {
  deploymentLogs,
  deploymentLogListeners
} = require('../../../common/deploymentLogger');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function buildlog ({ db, config }, request, response, tokens) {
  function outputLogs () {
    if (!deploymentLogs[tokens.deploymentId]) {
      return false;
    }

    response.writeHead(200);
    response.write(deploymentLogs[tokens.deploymentId]);
    function write (data) {
      if (data === null) {
        response.end();
      } else {
        response.write(data);
      }
    }
    deploymentLogListeners[tokens.deploymentId] = deploymentLogListeners[tokens.deploymentId] || [];
    deploymentLogListeners[tokens.deploymentId].push(write);

    return true;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    if (outputLogs()) {
      return;
    }
    await sleep(2500);
  }

  response.writeHead(404);
  response.end();
}

module.exports = buildlog;
