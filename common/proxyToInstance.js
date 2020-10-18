const http = require('http');

const selectRandomItemFromArray = require('./selectRandomItemFromArray');

async function proxyToInstance ({ db }, request, response) {
  let hostname = request.headers.host.split(':')[0];
  let branch;

  if (!hostname.includes('--')) {
    [hostname, branch] = hostname.split('--');
  }

  branch = branch || 'production';

  const service = await db.getOne('services', {
    query: {
      domain: hostname
    }
  });

  if (!service) {
    response.writeHead(404);
    response.end(`no service for host ${request.headers.host} found`);
    return;
  }

  const deployment = await db.getOne('deployments', {
    query: {
      serviceId: service.id,
      title: branch
    }
  });

  if (!deployment) {
    response.writeHead(404);
    response.end(`no deployment for host ${request.headers.host} found`);
    return;
  }

  const instances = await db.getAll('instances', {
    query: {
      deploymentId: deployment.id,
      status: 'healthy'
    }
  });

  if (instances.length === 0) {
    response.writeHead(404);
    response.end(`no instances for host ${request.headers.host} found`);
    return;
  }

  const instance = selectRandomItemFromArray(instances);

  const server = await db.getOne('servers', {
    id: instance.serverId
  });

  const proxyRequest = http.request(`http://${server.hostname}:${instance.dockerPort}${request.url}`, {
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
