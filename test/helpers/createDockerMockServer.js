const http = require('http');
const uuid = require('uuid').v4;
const writeResponse = require('write-response');
const routemeup = require('routemeup');
const finalStream = require('final-stream');

const defaultControllers = {
  '/v1.40/containers/create': (request, response) => {
    writeResponse(200, {
      Id: uuid()
    }, response);
  },

  '/v1.26/containers/:containerId/start': (request, response, tokens) => {
    writeResponse(200, {
      Id: tokens.containerId
    }, response);
  },

  '/v1.26/containers/:containerId/json': (request, response, tokens) => {
    writeResponse(200, {
      Id: tokens.containerId,
      NetworkSettings: {
        Ports: [
          [{
            HostPort: '8082'
          }]
        ]
      }
    }, response);
  },

  '/v1.26/containers/:containerId/exec': (request, response, tokens) => {
    writeResponse(200, {
      Id: tokens.containerId
    }, response);
  },

  '/v1.26/exec/:containerId/start': (request, response, tokens) => {
    writeResponse(200, {
      Id: tokens.containerId
    }, response);
  },

  '/v1.40/images/json': (request, response, tokens) => {
    writeResponse(200, [{
      Id: tokens.containerId
    }], response);
  },

  '/v1.40/containers/:containerId/archive': async (request, response, tokens) => {
    await finalStream(request);

    writeResponse(200, {
      Id: tokens.containerId
    }, response);
  }
};

function createDockerMockServer (controllers) {
  const server = http.createServer(function (request, response) {
    // console.log('dockerMockServer hit:', request.method, request.url);
    const route = routemeup({
      ...defaultControllers,
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
    server.listen('/tmp/docker.mock.sock');
  });
}

module.exports = createDockerMockServer;
