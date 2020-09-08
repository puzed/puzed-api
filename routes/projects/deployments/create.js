const { promisify } = require('util');

const axios = require('axios');
const uuid = require('uuid').v4;
const postgres = require('postgres-fp/promises');
const writeResponse = require('write-response');
const finalStream = promisify(require('final-stream'));

const getLatestCommitHash = require('../../../common/getLatestCommitHash');
const authenticate = require('../../../common/authenticate');
const pickRandomServer = require('../../../common/pickRandomServer');

async function createDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const body = await finalStream(request, JSON.parse);
  body.branch = body.branch || 'master';

  const project = await postgres.getOne(db, `
    SELECT *
      FROM "projects"
     WHERE "userId" = $1 AND "id" = $2
  `, [user.id, tokens.projectId]);

  if (!project) {
    throw Object.assign(new Error('project not found'), { statusCode: 404 });
  }

  const deploymentsInGroup = await postgres.getAll(db, `
    SELECT "group", "commitHash"
      FROM "deployments"
    WHERE "projectId" = $1
      AND "group" = $2
 GROUP BY "group", "commitHash"
  `, [project.id, body.group]);
  console.log(deploymentsInGroup);
  if (deploymentsInGroup.length > 1) {
    throw Object.assign(new Error('multiple commit hashes. clean up group before creating new deployments'), { statusCode: 400 });
  }

  let commitHash = deploymentsInGroup[0] && deploymentsInGroup[0].commitHash;
  if (!commitHash) {
    commitHash = await getLatestCommitHash({ db, config }, project, body.branch);
  }

  const server = await pickRandomServer({ db });

  const deploymentId = uuid();
  await postgres.insert(db, 'deployments', {
    id: deploymentId,
    projectId: project.id,
    dockerHost: server.hostname,
    commitHash,
    branch: body.branch,
    group: body.group,
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
