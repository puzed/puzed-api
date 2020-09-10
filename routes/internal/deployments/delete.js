const axios = require('axios');
const postgres = require('postgres-fp/promises');

async function deleteContainer ({ db, config }, request, response, tokens) {
  const instance = await postgres.getOne(db, `
    SELECT "instances".*
      FROM "instances"
     WHERE "instances"."id" = $1
  `, [tokens.instanceId]);

  try {
    const upstreamRequest = await axios({
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${instance.dockerId}/logs?stderr=1&stdout=1&timestamps=1`,
      responseEncoding: 'ascii'
    });

    await axios({
      method: 'DELETE',
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${instance.dockerId}?force=true`,
      responseEncoding: 'ascii'
    });

    const logsCleaned = upstreamRequest.data
      .split('\n')
      .map(line => line.slice(8))
      .join('\n');

    await postgres.run(db, `
      UPDATE "instances"
        SET "liveLog" = $1,
            "status" = 'destroyed'
      WHERE "id" = $2
    `, [logsCleaned + '\n\nInstance container was destroyed\n', tokens.instanceId]);

    response.writeHead(200);
    response.end();
  } catch (error) {
    response.writeHead(500);
    response.end('unexpected server error');
  }
}

module.exports = deleteContainer;
