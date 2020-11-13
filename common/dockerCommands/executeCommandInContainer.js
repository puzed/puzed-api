const axios = require('axios');

async function executeCommandInContainer ({ config }, containerId, command) {
  const executeResponse = await axios({
    method: 'post',
    socketPath: config.dockerSocketPath,
    url: `/v1.26/containers/${containerId}/exec`,
    headers: {
      'content-type': 'application/json'
    },
    data: JSON.stringify({
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['sh', '-c', command]
    })
  });

  const startResponse = await axios({
    method: 'post',
    socketPath: config.dockerSocketPath,
    url: `/v1.26/exec/${executeResponse.data.Id}/start`,
    headers: {
      'content-type': 'application/json'
    },
    data: JSON.stringify({
    })
  });

  return startResponse;
}

module.exports = executeCommandInContainer;
