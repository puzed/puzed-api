const axios = require('axios');
const uuid = require('uuid').v4;
const writeResponse = require('write-response');

const buildInsertStatement = require('../../../../common/buildInsertStatement');
const authenticate = require('../../../../common/authenticate');
const pickRandomServer = require('../../../../common/pickRandomServer');

async function createInstance ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const project = await db.getOne(`
    SELECT *
      FROM "projects"
     WHERE "userId" = $1 AND "id" = $2
  `, [user.id, tokens.projectId]);

  const deployment = await db.getOne(`
    SELECT "deployments".*
      FROM "deployments"
 LEFT JOIN "projects" ON "projects".id = "deployments"."projectId"
     WHERE "userId" = $1
       AND "deployments"."projectId" = $2
       AND "deployments"."id" = $3
  `, [user.id, tokens.projectId, tokens.deploymentId]);

  if (!project) {
    throw Object.assign(new Error('project not found'), { statusCode: 404 });
  }

  if (!deployment) {
    throw Object.assign(new Error('deployment not found'), { statusCode: 404 });
  }

  const server = await pickRandomServer({ db });

  const instanceId = uuid();
  const statement = buildInsertStatement('instances', {
    id: instanceId,
    projectId: project.id,
    deploymentId: deployment.id,
    dockerHost: server.hostname,
    commitHash: deployment.commitHash,
    status: 'queued',
    dateCreated: Date.now()
  });
  await db.run(statement.sql, statement.parameters);

  axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instanceId}`, {
    method: 'POST',
    headers: {
      host: config.domains.api[0],
      'x-internal-secret': config.internalSecret
    }
  });

  const instance = await db.getOne('SELECT * FROM "instances" WHERE "id" = $1', [instanceId]);

  writeResponse(200, instance, response);
}

module.exports = createInstance;
