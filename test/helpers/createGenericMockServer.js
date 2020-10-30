const http = require('http');
const routemeup = require('routemeup');

function createGenericMockServer (port, controllers) {
  const server = http.createServer(function (request, response) {
    const route = routemeup({
      ...controllers
    }, request);
    if (route) {
      return route.controller(request, response, route.tokens);
    }

    response.writeHead(404);
    response.end('Not Found');
  });

  return new Promise(resolve => {
    server.on('listening', () => {
      resolve({
        close: server.close.bind(server)
      });
    });
    server.listen(port);
  });
}

module.exports = createGenericMockServer;
