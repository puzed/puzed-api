const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../common/authenticate');

async function readProject ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const project = await postgres.getOne(db, `
    SELECT * FROM projects WHERE user_id = $1 AND id = $2
  `, [user.id, tokens.projectId]);

  writeResponse(200, project, response);
}

module.exports = readProject;
