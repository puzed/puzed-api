const writeResponse = require('write-response');

const listProjects = require('../../services/projects/listProjects');
const authenticate = require('../../common/authenticate');
const presentProject = require('../../presenters/project');

async function listProjectsRoute (scope, request, response) {
  const user = await authenticate(scope, request.headers.authorization);

  const projects = await listProjects(scope, user.id);

  writeResponse(200, projects.map(presentProject), response);
}

module.exports = listProjectsRoute;
