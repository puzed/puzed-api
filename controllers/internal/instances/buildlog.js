const {
  instanceLogs,
  instanceLogListeners
} = require('../../../common/instanceLogger');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function buildlog ({ db, config }, request, response, tokens) {
  function outputLogs () {
    if (!instanceLogs[tokens.instanceId]) {
      return false;
    }

    response.writeHead(200);
    response.write(instanceLogs[tokens.instanceId]);
    function write (data) {
      if (data === null) {
        response.end();
      } else {
        response.write(data);
      }
    }
    instanceLogListeners[tokens.instanceId] = instanceLogListeners[tokens.instanceId] || [];
    instanceLogListeners[tokens.instanceId].push(write);

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
