const writeResponse = require('write-response');
const axios = require('axios');
const postgres = require('postgres-fp/promises');

async function readProject ({ db, config }, request, response, tokens) {
  const user = await axios(config.githubApiUrl + '/user', {
    headers: {
      authorization: request.headers.authorization
    }
  });

  const project = await postgres.getOne(db, `
    SELECT * FROM projects WHERE username = $1 AND id = $2
  `, [user.data.login, tokens.projectId]);

  writeResponse(200, project, response);
}

module.exports = readProject;
