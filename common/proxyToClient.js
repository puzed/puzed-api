const http = require('http');

async function proxyToClient ({ db }, request, response) {
  const proxyRequest = http.request(`http://localhost:8000${request.url}`, {
    method: request.method
  }, function (proxyResponse) {
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    proxyResponse.pipe(response);
  });

  proxyRequest.on('error', error => {
    console.log(error);
    response.writeHead(500);
    response.end('Unexpected error');
  });

  proxyRequest.end();
}

module.exports = proxyToClient;
