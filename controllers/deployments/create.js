const writeResponse = require('write-response');
const finalStream = require('final-stream');

const pickRandomServer = require('../../common/pickRandomServer');
const authenticate = require('../../common/authenticate');

const getDeploymentById = require('../../queries/deployments/getDeploymentById');

async function createDeployment ({ db, config, notify, providers }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

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
  const commitHash = await provider.getLatestCommitHash({ db, config }, user, service, body.branch);

  const guardian = await pickRandomServer({ db });

  const postedDeployment = await db.post('deployments', {
    serviceId: service.id,
    ...body,
    commitHash,
    guardianServerId: guardian.id,
    dateCreated: Date.now()
  });

  const deployment = await getDeploymentById({ db }, user.id, tokens.serviceId, postedDeployment.id);

  notify.broadcast(service.id);

  writeResponse(200, deployment, response);
}

module.exports = createDeployment;
