const writeResponse = require('write-response');
const finalStream = require('final-stream');

const authenticate = require('../../common/authenticate');
const buildImage = require('../../common/buildImage');

const getDeploymentById = require('../../queries/deployments/getDeploymentById');

async function createDeployment (scope, request, response, tokens) {
  const { db, notify, providers } = scope;
  const { user } = await authenticate(scope, request.headers.authorization);

  let body;
  try {
    body = await finalStream(request)
      .then(buffer => buffer.toString('utf8'))
      .then(JSON.parse);
  } catch (error) {
    throw Object.assign(new Error('invalid post body'), { statusCode: 400 });
  }

  body.branch = body.branch || 'master';

  const service = await db.getOne('services', {
    query: {
      userId: user.id,
      id: tokens.serviceId
    }
  });

  const link = await db.getOne('links', {
    query: {
      id: service.linkId
    }
  });

  if (!service) {
    throw Object.assign(new Error('service not found'), { statusCode: 404 });
  }

  const provider = providers[link.providerId];
  const commitHash = await provider.getLatestCommitHash(scope, user, service, body.branch);

  const postedDeployment = await db.post('deployments', {
    serviceId: service.id,
    service,
    ...body,
    subdomain: (body.subdomain || body.title || '').toLowerCase(),
    commitHash,
    guardianServerId: scope.config.serverId,
    dateCreated: Date.now()
  });

  const deployment = await getDeploymentById(scope, user.id, tokens.serviceId, postedDeployment.id);

  buildImage(scope, postedDeployment.id);
  notify.broadcast(service.id);

  writeResponse(200, deployment, response);
}

module.exports = createDeployment;
