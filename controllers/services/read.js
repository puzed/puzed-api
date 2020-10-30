const writeResponse = require('write-response');

const getServiceById = require('../../queries/services/getServiceById');
const authenticate = require('../../common/authenticate');

async function readService (scope, request, response, tokens) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const url = new URL(request.url, 'http://localhost');

  const service = await getServiceById(scope, user.id, tokens.serviceId, url.searchParams.get('join[deployments]'));

  if (!service) {
    throw Object.assign(new Error('service not found'), { statusCode: 404 });
  }

  const secrets = service.secrets ? JSON.parse(service.secrets) : {};
  secrets.forEach(secret => {
    delete secret.file;
    delete secret.data;
  });

  writeResponse(200, {
    ...service,
    secrets
  }, response);
}

module.exports = readService;
