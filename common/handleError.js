function handleError (error, request, response) {
  console.log(error);
  response.writeHead(500);
  response.end('Unexpected Server Error');
}

module.exports = handleError;
