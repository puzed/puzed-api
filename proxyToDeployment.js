const http = require('http');

const postgres = require('postgres-fp/promises');

async function proxyToDeployment ({ db }, request, response) {
  const record = await postgres.getOne(db, `
    SELECT dockerhost, dockerid, dockerport
      FROM deployments
 LEFT JOIN projects ON projects.id = deployments.projectId
     WHERE domain = $1
       AND status = 'success'
  ORDER BY random()
     LIMIT 1
  `, [request.headers.host.split(':')[0]]);

  if (!record) {
    response.writeHead(404);
    response.end(`service ${request.headers.host} not found`);
    return;
  }

  const proxyRequest = http.request(`http://${record.dockerhost}:${record.dockerport}${request.url}`, {
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
