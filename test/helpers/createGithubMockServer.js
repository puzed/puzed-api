const http = require('http');
const routemeup = require('routemeup');

function createGithubMockServer (routes) {
  const server = http.createServer(function (request, response) {
    console.log('githubMockServer hit:', request.method, request.url);
    const route = routemeup(routes, request);
    if (route) {
      return route.controller(request, response, route.tokens);
    }

    response.writeHead(404);
    response.end('Not Found');
  });

  return new Promise(resolve => {
    server.on('listening', () => {
      resolve({
        url: 'http://localhost:' + server.address().port,
        close: server.close.bind(server)
      });
    });
    server.listen();
  });
}

module.exports = createGithubMockServer;
