const http = require('http');

const postgres = require('postgres-fp/promises');

async function proxyToDeployment ({ db }, request, response) {
  const record = await postgres.getOne(db, `
  SELECT * FROM (
    SELECT "dockerHost", "dockerId", "dockerPort"
      FROM "deployments"
 LEFT JOIN "projects" ON "projects"."id" = "deployments"."projectId"
     WHERE "domain" = $1
       AND "status" = 'healthy'
       AND "projects"."commitHashProduction" = "deployments"."commitHash"
)
  ORDER BY random()
     LIMIT 1
  `, [request.headers.host.split(':')[0]]);
  console.log(record);
  if (!record) {
    response.writeHead(404);
    response.end(`service ${request.headers.host} not found`);
    return;
  }

  const proxyRequest = http.request(`http://${record.dockerHost}:${record.dockerPort}${request.url}`, {
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

module.exports = proxyToDeployment;
