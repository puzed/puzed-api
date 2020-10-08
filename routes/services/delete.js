const writeResponse = require('write-response');

const deleteServiceById = require('../../services/services/deleteServiceById');
const authenticate = require('../../common/authenticate');

async function deleteService (scope, request, response, tokens) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const service = await deleteServiceById(scope, user.id, tokens.serviceId);

  if (!service) {
    throw Object.assign(new Error('service not found'), { statusCode: 404 });
  }

  writeResponse(200, service, response);
}

module.exports = deleteService;
