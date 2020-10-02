const http = require('http');

async function proxyToInstance ({ db }, request, response) {
  let hostname = request.headers.host.split(':')[0];

  if (!hostname.includes('--')) {
    hostname = 'production--' + hostname;
  }

  const record = await db.getOne(`
  SELECT * FROM (
    SELECT "hostname", "dockerId", "dockerPort"
      FROM "instances"
 LEFT JOIN "servers" ON "servers"."id" = "instances"."serverId"
 LEFT JOIN "services" ON "services"."id" = "instances"."serviceId"
 LEFT JOIN "deployments" ON "deployments"."id" = "instances"."deploymentId"
     WHERE (
      concat("deployments"."title", '--', "domain") = $1
      OR "domain" = $1
     ) AND "status" = 'healthy'
) a
  ORDER BY random()
     LIMIT 1
  `, [hostname]);

  if (!record) {
    response.writeHead(404);
    response.end(`no instances for host ${request.headers.host} found`);
    return;
  }

  const proxyRequest = http.request(`http://${record.hostname}:${record.dockerPort}${request.url}`, {
    method: request.method,
    headers: request.headers
  }, function (proxyResponse) {
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    proxyResponse.pipe(response);
  });

  proxyRequest.on('error', error => {
    if (error.code === 'ECONNREFUSED') {
      response.writeHead(502);
      response.end();
      return;
    }
    if (error.code === 'ECONNRESET') {
      response.writeHead(502);
      response.end();
      return;
    }
    console.log(error);
    response.writeHead(500);
    response.end();
  });

  proxyRequest.end();
}

module.exports = proxyToInstance;
