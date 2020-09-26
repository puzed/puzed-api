const writeResponse = require('write-response');

const authenticate = require('../../common/authenticate');

async function readProject ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const project = await db.getOne(`
    SELECT * FROM "projects" WHERE "userId" = $1 AND "id" = $2
  `, [user.id, tokens.projectId]);

  if (!project) {
    throw Object.assign(new Error('project not found'), { statusCode: 404 });
  }

  const secrets = project.secrets ? JSON.parse(project.secrets) : {};
  secrets.forEach(secret => {
    delete secret.file;
    delete secret.data;
  });

  writeResponse(200, {
    ...project,
    secrets
  }, response);
}

module.exports = readProject;
