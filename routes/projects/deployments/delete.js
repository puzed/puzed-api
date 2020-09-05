const axios = require('axios');

const writeResponse = require('write-response');
const dockerAgent = require('docker-ssh-http-agent');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function deleteDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await postgres.getOne(db, `
    SELECT deployments.*
      FROM deployments
 LEFT JOIN projects ON deployments.projectId = projects.id
     WHERE userId = $1 AND projectId = $2 AND deployments.id = $3
 `, [user.id, tokens.projectId, tokens.deploymentId]);

  if (!deployment) {
    throw Object.assign(new Error('deployment not found'), { statusCode: 404 });
  }

  const agent = dockerAgent({
    host: deployment.host,
    port: 22,
    username: config.sshUsername,
    privateKey: config.sshPrivateKey
  });

  const upstreamRequest = await axios({
    socketPath: '/var/run/docker.sock',
    url: `/v1.26/containers/${deployment.dockerId}/logs?stderr=1&stdout=1&timestamps=1`,
    responseEncoding: 'ascii',
    httpsAgent: agent
  });

  await axios({
    method: 'DELETE',
    socketPath: '/var/run/docker.sock',
    url: `/v1.26/containers/${deployment.dockerId}?force=true`,
    responseEncoding: 'ascii',
    httpsAgent: agent
  });

  const logsCleaned = upstreamRequest.data
    .split('\n')
    .map(line => line.slice(8))
    .join('\n');

  await postgres.run(db, `
    UPDATE "deployments"
       SET "liveLog" = $1,
           "status" = 'destroyed'
     WHERE "projectId" = $2
       AND id = $3
  `, [logsCleaned + '\n\nDeployment container was destroyed\n', tokens.projectId, tokens.deploymentId]);

  writeResponse(200, '', response);
}

module.exports = deleteDeployment;
