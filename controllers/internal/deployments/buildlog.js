const { isLoggerActive, streamLogData } = require('../../../common/liveLogger');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function buildlog ({ db, config }, request, response, tokens) {
  function outputLogs () {
    if (!isLoggerActive(tokens.deploymentId)) {
      return false;
    }

    response.writeHead(200);

    function write (data) {
      if (data === null) {
        response.end();
      } else {
        if (!response.writableEnded) {
          response.write(data);
        }
      }
    }
    streamLogData(tokens.deploymentId, write);

    return true;
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    if (outputLogs()) {
      return;
    }
    await sleep(500);
  }

  response.writeHead(404);
  response.end();
}

module.exports = buildlog;
