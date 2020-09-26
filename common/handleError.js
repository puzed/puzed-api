function handleError (error, request, response) {
  if (error.statusCode) {
    response.writeHead(error.statusCode);
    response.end(error.message);
    return;
  }

  console.log(error);

  response.writeHead(500);
  response.end('Unexpected Server Error');
}

module.exports = handleError;
