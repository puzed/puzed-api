const fs = require('fs');
const axios = require('axios');

async function extractTarIntoContainer ({ config }, containerId, tarPath, destination) {
  const executeResponse = await axios({
    method: 'put',
    socketPath: config.dockerSocketPath,
    url: `/v1.40/containers/${containerId}/archive?path=${destination}`,
    headers: {
      'content-type': 'application/x-tar'
    },
    data: fs.createReadStream(tarPath)
  });

  return executeResponse;
}

module.exports = extractTarIntoContainer;
