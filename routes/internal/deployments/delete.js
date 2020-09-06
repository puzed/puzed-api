const axios = require('axios');
const postgres = require('postgres-fp/promises');

async function deleteContainer ({ db, config }, request, response, tokens) {
  const deployment = await postgres.getOne(db, `
    SELECT "deployments".*
      FROM "deployments"
     WHERE "deployments"."id" = $1
  `, [tokens.deploymentId]);

  try {
    const upstreamRequest = await axios({
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${deployment.dockerId}/logs?stderr=1&stdout=1&timestamps=1`,
      responseEncoding: 'ascii'
    });

    await axios({
      method: 'DELETE',
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${deployment.dockerId}?force=true`,
      responseEncoding: 'ascii'
    });

    const logsCleaned = upstreamRequest.data
      .split('\n')
      .map(line => line.slice(8))
      .join('\n');

    await postgres.run(db, `
      UPDATE "deployments"
        SET "liveLog" = $1,
            "status" = 'destroyed'
      WHERE "id" = $2
    `, [logsCleaned + '\n\nDeployment container was destroyed\n', tokens.deploymentId]);

    response.writeHead(200);
    response.end();
  } catch (error) {
    response.writeHead(500);
    response.end('unexpected server error');
  }
}

module.exports = deleteContainer;
