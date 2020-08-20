const writeResponse = require('write-response');
const axios = require('axios');
const postgres = require('postgres-fp/promises');

async function listDeployments ({ db, config }, request, response, tokens) {
  if (!request.headers.authorization) {
    throw Object.assign(new Error('unauthorized'), {statusCode: 401})
  }

  const user = await axios(config.githubApiUrl + '/user', {
    headers: {
      authorization: request.headers.authorization
    }
  });

  const deployments = await postgres.getAll(db, `
    SELECT * FROM deployments WHERE projectid = $1
  `, [tokens.projectId]);

  writeResponse(200, deployments, response);
}

module.exports = listDeployments;
