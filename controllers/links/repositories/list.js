const writeResponse = require('write-response');

const getLinkById = require('../../../queries/links/getLinkById');
const authenticate = require('../../../common/authenticate');

async function linkRepositoriesListRoute (scope, request, response, tokens) {
  const { providers } = scope;

  const { user } = await authenticate(scope, request.headers.authorization);

  const link = await getLinkById(scope, user.id, tokens.linkId);

  if (!link) {
    throw Object.assign(new Error('link not found'), { statusCode: 404 });
  }

  const provider = providers[link.providerId];

  if (!provider) {
    throw Object.assign(new Error('provider not found'), { statusCode: 500 });
  }

  const repositories = await provider.listRepositories(scope, user.id, tokens.linkId);

  writeResponse(200, repositories, response);
}

module.exports = linkRepositoriesListRoute;
