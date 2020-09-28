const writeResponse = require('write-response');

function handleError (error, request, response) {
  if (error.statusCode) {
    writeResponse(error.statusCode, error.message, response);
    return;
  }

  console.log(error);

  writeResponse(500, { error: { messages: ['unexpected server error'] } }, response);
}

module.exports = handleError;
