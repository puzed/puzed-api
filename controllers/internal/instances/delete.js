const axios = require('axios');
const performUsageCalculations = require('../../.././common/performUsageCalculations');

async function deleteContainer (scope, request, response, tokens) {
  const { db, config, notify } = scope;

  const instance = await db.getOne('instances', {
    query: {
      id: tokens.instanceId
    }
  });

  try {
    const upstreamRequest = await axios({
      socketPath: config.dockerSocketPath,
      url: `/v1.26/containers/${instance.dockerId}/logs?stderr=1&stdout=1&timestamps=1`,
      validateStatus: statusCode => [200, 404].includes(statusCode),
      responseEncoding: 'ascii'
    });

    await performUsageCalculations(scope, instance.id);

    await axios({
      method: 'DELETE',
      socketPath: config.dockerSocketPath,
      url: `/v1.26/containers/${instance.dockerId}?force=true`,
      validateStatus: statusCode => [200, 204, 404].includes(statusCode),
      responseEncoding: 'ascii'
    });

    if (upstreamRequest.status === 200) {
      const logsCleaned = upstreamRequest.data
        .split('\n')
        .map(line => line.slice(8))
        .join('\n');

      await db.post('instanceLogs', {
        instanceId: instance.id,
        data: logsCleaned + '\n\nInstance container was destroyed\n'
      });
    }
  } catch (error) {
    console.log(error);
  }

  await db.patch('instances', {
    status: 'destroyed'
  }, {
    query: {
      id: tokens.instanceId
    }
  });

  notify.broadcast(tokens.instanceId);

  response.writeHead(200);
  response.end();
}

module.exports = deleteContainer;
