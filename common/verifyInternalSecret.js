const hint = require('../modules/hint');

const verifyInternalSecret = (handler) => (scope, request, response, tokens) => {
  if (request.headers['x-internal-secret'] !== scope.config.internalSecret) {
    hint('puzed.router.failure', `internal secret "${request.headers['x-internal-secret']}" is not the expected "${scope.config.internalSecret}"`);
    response.writeHead(401);
    response.end('restricted to internal requests only');
    return;
  }
  return handler(scope, request, response, tokens);
};

module.exports = verifyInternalSecret;
