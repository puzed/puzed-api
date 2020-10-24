const writeResponse = require('write-response');

async function listRepositoriesHandler (scope, request, response, tokens) {
  writeResponse(200, [], response);
}

module.exports = listRepositoriesHandler;
