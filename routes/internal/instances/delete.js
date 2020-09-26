const axios = require('axios');

async function deleteContainer ({ db, config, notify }, request, response, tokens) {
  const instance = await db.getOne(`
    SELECT "instances".*
      FROM "instances"
     WHERE "instances"."id" = $1
  `, [tokens.instanceId]);

  let logsCleaned;
  try {
    const upstreamRequest = await axios({
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${instance.dockerId}/logs?stderr=1&stdout=1&timestamps=1`,
      validateStatus: () => true,
      responseEncoding: 'ascii'
    });

    await axios({
      method: 'DELETE',
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${instance.dockerId}?force=true`,
      responseEncoding: 'ascii'
    });

    logsCleaned = upstreamRequest.data
      .split('\n')
      .map(line => line.slice(8))
      .join('\n');
  } catch (error) {
    console.log(error);
  }

  await db.run(`
    UPDATE "instances"
      SET "liveLog" = $1,
          "status" = 'destroyed'
    WHERE "id" = $2
  `, [logsCleaned + '\n\nInstance container was destroyed\n', tokens.instanceId]);

  notify.broadcast(tokens.instanceId);

  response.writeHead(200);
  response.end();
}

module.exports = deleteContainer;
