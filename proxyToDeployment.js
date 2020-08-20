const http = require('http');

const postgres = require('postgres-fp/promises');

async function proxyToDeployment ({ db }, request, response) {
  const record = await postgres.getOne(db, `
    SELECT dockerhost, dockerid, dockerport
      FROM deployments
 LEFT JOIN projects ON projects.id = deployments.projectId
     WHERE domain = $1
  ORDER BY random()
     LIMIT 1
  `, [request.headers.host]);

  if (!record) {
    response.writeHead(404);
    response.end(`Domain ${request.headers.host} is not hosted here`);
    return;
  }

  const proxyRequest = http.request(`http://${record.dockerhost}:${record.dockerport}${request.url}`, function (proxyResponse) {
    proxyResponse.pipe(response);
  });

  proxyRequest.on('error', error => {
    response.writeHead(500);
    response.end('Unexpected error');
  })

  proxyRequest.end();
}

module.exports = proxyToDeployment;
