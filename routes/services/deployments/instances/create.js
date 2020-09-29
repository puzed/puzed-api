const axios = require('axios');
const uuid = require('uuid').v4;
const writeResponse = require('write-response');

const buildInsertStatement = require('../../../../common/buildInsertStatement');
const authenticate = require('../../../../common/authenticate');
const pickRandomServer = require('../../../../common/pickRandomServer');

async function createInstance ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const service = await db.getOne(`
    SELECT *
      FROM "services"
     WHERE "userId" = $1 AND "id" = $2
  `, [user.id, tokens.serviceId]);

  const deployment = await db.getOne(`
    SELECT "deployments".*
      FROM "deployments"
 LEFT JOIN "services" ON "services".id = "deployments"."serviceId"
     WHERE "userId" = $1
       AND "deployments"."serviceId" = $2
       AND "deployments"."id" = $3
  `, [user.id, tokens.serviceId, tokens.deploymentId]);

  if (!service) {
    throw Object.assign(new Error('service not found'), { statusCode: 404 });
  }

  if (!deployment) {
    throw Object.assign(new Error('deployment not found'), { statusCode: 404 });
  }

  const server = await pickRandomServer({ db });

  const instanceId = uuid();
  const statement = buildInsertStatement('instances', {
    id: instanceId,
    serviceId: service.id,
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
