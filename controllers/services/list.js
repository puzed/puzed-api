const writeResponse = require('write-response');

const listServices = require('../../queries/services/listServices');
const authenticate = require('../../common/authenticate');
const presentService = require('../../presenters/service');

async function listServicesRoute (scope, request, response) {
  const { user } = await authenticate(scope, request.headers.authorization);

  const url = new URL(request.url, 'http://localhost');

  const services = await listServices(scope, user.id, url.searchParams.get('join[deployments]'));

  writeResponse(200, services.map(presentService), response);
}

module.exports = listServicesRoute;
