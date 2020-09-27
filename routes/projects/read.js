const writeResponse = require('write-response');

const getProjectById = require('../../services/projects/getProjectById');
const authenticate = require('../../common/authenticate');

async function readProject (scope, request, response, tokens) {
  const user = await authenticate(scope, request.headers.authorization);

  const project = await getProjectById(scope, user.id, tokens.projectId);

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
