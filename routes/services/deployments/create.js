const uuid = require('uuid').v4;
const writeResponse = require('write-response');
const finalStream = require('final-stream');

const pickRandomServer = require('../../../common/pickRandomServer');
const buildInsertStatement = require('../../../common/buildInsertStatement');
const authenticate = require('../../../common/authenticate');

const getDeploymentById = require('../../../services/deployments/getDeploymentById');

async function createDeployment ({ db, config, providers }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const body = await finalStream(request)
    .then(buffer => buffer.toString('utf8'))
    .then(JSON.parse);

  body.branch = body.branch || 'master';

  const service = await db.getOne(`
    SELECT "services".*, "providerId"
      FROM "services"
 LEFT JOIN "links" ON "links"."id" = "services"."linkId"
     WHERE "services"."userId" = $1
       AND "services"."id" = $2
  `, [user.id, tokens.serviceId]);

  if (!service) {
    throw Object.assign(new Error('service not found'), { statusCode: 404 });
  }

  const provider = providers[service.providerId];
  const commitHash = await provider.getLatestCommitHash({ db, config }, user, service, body.branch);

  const deploymentId = uuid();

  const guardian = await pickRandomServer({ db });

  const statement = buildInsertStatement('deployments', {
    id: deploymentId,
    serviceId: service.id,
    title: body.title,
    commitHash,
    guardianServerId: guardian.id,
    dateCreated: Date.now()
  });
  await db.run(statement.sql, statement.parameters);

  const deployment = await getDeploymentById({ db }, user.id, tokens.serviceId, deploymentId);

  writeResponse(200, deployment, response);
}

module.exports = createDeployment;
