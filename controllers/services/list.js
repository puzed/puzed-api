const writeResponse = require('write-response');

const listServices = require('../../queries/services/listServices');
const authenticate = require('../../common/authenticate');
const presentService = require('../../presenters/service');

async function listServicesRoute (scope, request, response) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const services = await listServices(scope, user.id);

  writeResponse(200, services.map(presentService), response);
}

module.exports = listServicesRoute;
