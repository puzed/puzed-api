const axios = require('axios');

const uuid = require('uuid').v4;
const postgres = require('postgres-fp/promises');
const writeResponse = require('write-response');

const authenticate = require('../../../common/authenticate');
const pickRandomServer = require('../../../common/pickRandomServer');

async function createDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const project = await postgres.getOne(db, `
    SELECT *
      FROM "projects"
     WHERE "userId" = $1 AND "id" = $2
  `, [user.id, tokens.projectId]);

  if (!project) {
    throw Object.assign(new Error('project not found'), { statusCode: 404 });
  }

  const server = await pickRandomServer({ db });

  const deploymentId = uuid();
  await postgres.insert(db, 'deployments', {
    id: deploymentId,
    projectId: project.id,
    dockerHost: server.hostname,
    commitHash: project.commitHashProduction,
    status: 'queued',
    dateCreated: Date.now()
  });

  await axios(`https://${server.hostname}:${server.apiPort}/internal/deployments/${deploymentId}`, {
    method: 'POST',
    headers: {
      host: config.domains.api[0],
      'x-internal-secret': config.internalSecret
    }
  });

  const deployment = await postgres.getOne(db, 'SELECT * FROM "deployments" WHERE "id" = $1', [deploymentId]);

  writeResponse(200, deployment, response);
}

module.exports = createDeployment;
