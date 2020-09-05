const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../common/authenticate');

async function listProjects ({ db, config }, request, response) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const projects = await postgres.getAll(db, `
    SELECT * FROM "projects" WHERE "userId" = $1
  `, [user.id]);

  writeResponse(200, projects, response);
}

module.exports = listProjects;
