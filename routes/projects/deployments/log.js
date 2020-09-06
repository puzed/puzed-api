const http = require('http');

const writeResponse = require('write-response');
const dockerAgent = require('docker-ssh-http-agent');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function logDeployment ({ db, config }, request, response, tokens) {
  request.setTimeout(60 * 60 * 1000);
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await postgres.getOne(db, `
    SELECT "deployments".*
      FROM "deployments"
 LEFT JOIN "projects" ON "deployments"."projectId" = "projects"."id"
     WHERE "userId" = $1 AND "projectId" = $2 AND "deployments"."id" = $3
  `, [user.id, tokens.projectId, tokens.deploymentId]);

  if (deployment.status === 'destroyed') {
    writeResponse(200, deployment.liveLog, response);
    return;
  }

  const server = await postgres.getOne(db, `
    SELECT *
      FROM "servers"
     WHERE "hostname" = $1
  `, [deployment.dockerHost]);

  const agent = dockerAgent({
    host: server.hostname,
    port: server.sshPort,
    username: server.sshUsername,
    privateKey: server.privateKey,
    keepaliveInterval: 5000,
    keepaliveCountMax: 60 * 30
  });

  const upstreamRequest = http.request({
    socketPath: '/var/run/docker.sock',
    path: `/v1.26/containers/${deployment.dockerId}/logs?stderr=1&stdout=1&timestamps=1&follow=1&tail=10`,
    agent
  }, function (upstreamResponse) {
    response.writeHead(upstreamResponse.statusCode);
    upstreamResponse.pipe(response);
  });
  upstreamRequest.end();
}

module.exports = logDeployment;
