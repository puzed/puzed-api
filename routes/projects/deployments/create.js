const { promisify } = require('util');

const uuid = require('uuid').v4;
const writeResponse = require('write-response');
const finalStream = promisify(require('final-stream'));

const pickRandomServer = require('../../../common/pickRandomServer');
const getLatestCommitHash = require('../../../common/getLatestCommitHash');
const buildInsertStatement = require('../../../common/buildInsertStatement');
const authenticate = require('../../../common/authenticate');

async function createDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const body = await finalStream(request, JSON.parse);
  body.branch = body.branch || 'master';

  const project = await db.getOne(`
    SELECT *
      FROM "projects"
     WHERE "userId" = $1 AND "id" = $2
  `, [user.id, tokens.projectId]);

  if (!project) {
    throw Object.assign(new Error('project not found'), { statusCode: 404 });
  }

  const commitHash = await getLatestCommitHash({ db, config }, project, body.branch);

  const deploymentId = uuid();

  const guardian = await pickRandomServer({ db });

  const statement = buildInsertStatement('deployments', {
    id: deploymentId,
    projectId: project.id,
    title: body.title,
    commitHash,
    guardianServerId: guardian.id,
    dateCreated: Date.now()
  });
  await db.run(statement.sql, statement.parameters);

  const deployment = await db.getOne(`
    SELECT *,
      (
        SELECT count(*) 
          FROM "instances"
        WHERE "instances"."deploymentId" = "deployments"."id"
          AND "instances"."status" NOT IN ('destroyed')
      ) as "instanceCount"
      FROM "deployments"
     WHERE "id" = $1
  `, [deploymentId]);

  writeResponse(200, deployment, response);
}

module.exports = createDeployment;
