const writeResponse = require('write-response');
const axios = require('axios');
const postgres = require('postgres-fp/promises');

async function listProjects ({ db, config }, request, response) {
  if (!request.headers.authorization) {
    throw Object.assign(new Error('unauthorized'), {statusCode: 401})
  }

  const user = await axios(config.githubApiUrl + '/user', {
    headers: {
      authorization: request.headers.authorization
    }
  });

  const projects = await postgres.getAll(db, `
    SELECT * FROM projects WHERE username = $1
  `, [user.data.login]);

  writeResponse(200, projects, response);
}

module.exports = listProjects;
