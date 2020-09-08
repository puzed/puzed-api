const http = require('http');

const postgres = require('postgres-fp/promises');

async function proxyToDeployment ({ db }, request, response) {
  let hostname = request.headers.host.split(':')[0];

  if (!hostname.includes('--')) {
    hostname = 'master--' + hostname;
  }

  const record = await postgres.getOne(db, `
  SELECT * FROM (
    SELECT "dockerHost", "dockerId", "dockerPort", "group", concat("group", '--', "domain") as "domain"
      FROM "deployments"
 LEFT JOIN "projects" ON "projects"."id" = "deployments"."projectId"
     WHERE (
      concat("group", '--', "domain") = $1
     ) AND "status" = 'healthy'
)
  ORDER BY random()
     LIMIT 1
  `, [hostname]);

  if (!record) {
    response.writeHead(404);
    response.end(`no deployments for host ${request.headers.host} found`);
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
