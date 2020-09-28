const { promisify } = require('util');

const finalStream = promisify(require('final-stream'));

async function githubWebhookEndpointHandler (scope, request, response) {
  const data = await finalStream(request).then(buffer => buffer.toString('utf8'));

  console.log('Request received');
  console.log('     Host:', request.headers.host);
  console.log('   Method:', request.method);
  console.log('      URL:', request.url);
  console.log('     Data:', data);

  response.end();
}

module.exports = githubWebhookEndpointHandler;
