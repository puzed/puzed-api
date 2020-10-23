const http = require('http');

async function livelog ({ db, config }, request, response, tokens) {
  const instance = await db.getOne('instances', {
    query: {
      id: tokens.instanceId
    }
  });

  const upstreamRequest = http.request({
    socketPath: config.dockerSocketPath,
    path: `/v1.26/containers/${instance.dockerId}/logs?stderr=1&stdout=1&timestamps=1&follow=1&tail=10`
  }, function (upstreamResponse) {
    response.writeHead(upstreamResponse.statusCode);
    upstreamResponse.pipe(response);
  });
  upstreamRequest.end();
}

module.exports = livelog;
