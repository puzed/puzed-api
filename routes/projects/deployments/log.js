const http = require('http');

const dockerAgent = require('docker-ssh-http-agent');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function logDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployment = await postgres.getOne(db, `
    SELECT deployments.*
      FROM deployments
 LEFT JOIN projects ON deployments.projectid = projects.id
     WHERE user_id = $1 AND projectid = $2 AND deployments.id = $3
  `, [user.id, tokens.projectId, tokens.deploymentId]);

  const agent = dockerAgent({
    host: deployment.host,
    port: 22,
    username: config.sshUsername,
    privateKey: config.sshPrivateKey
  });

  const upstreamRequest = http.request({
    socketPath: '/var/run/docker.sock',
    path: `/v1.26/containers/${deployment.dockerid}/logs?stderr=1&stdout=1&timestamps=1&follow=1&tail=10`,
    agent
  }, function (upstreamResponse) {
    response.writeHead(upstreamResponse.statusCode);
    upstreamResponse.pipe(response);
  });
  upstreamRequest.end();
}

module.exports = logDeployment;
