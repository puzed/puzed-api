const { promisify } = require('util');

const axios = require('axios');
const uuid = require('uuid').v4;
const postgres = require('postgres-fp/promises');
const writeResponse = require('write-response');
const finalStream = promisify(require('final-stream'));

const getLatestCommitHash = require('../../../common/getLatestCommitHash');
const authenticate = require('../../../common/authenticate');
const pickRandomServer = require('../../../common/pickRandomServer');

async function createInstance ({ db, config }, request, response, tokens) {
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

  const instancesInGroup = await postgres.getAll(db, `
    SELECT "group", "commitHash"
      FROM "instances"
    WHERE "projectId" = $1
      AND "group" = $2
 GROUP BY "group", "commitHash"
  `, [project.id, body.group]);
  console.log(instancesInGroup);
  if (instancesInGroup.length > 1) {
    throw Object.assign(new Error('multiple commit hashes. clean up group before creating new instances'), { statusCode: 400 });
  }

  let commitHash = instancesInGroup[0] && instancesInGroup[0].commitHash;
  if (!commitHash) {
    commitHash = await getLatestCommitHash({ db, config }, project, body.branch);
  }

  const server = await pickRandomServer({ db });

  const instanceId = uuid();
  await postgres.insert(db, 'instances', {
    id: instanceId,
    projectId: project.id,
    dockerHost: server.hostname,
    commitHash,
    branch: body.branch,
    group: body.group,
    status: 'queued',
    dateCreated: Date.now()
  });

  axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instanceId}`, {
    method: 'POST',
    headers: {
      host: config.domains.api[0],
      'x-internal-secret': config.internalSecret
    }
  });

  const instance = await postgres.getOne(db, 'SELECT * FROM "instances" WHERE "id" = $1', [instanceId]);

  writeResponse(200, instance, response);
}

module.exports = createInstance;
