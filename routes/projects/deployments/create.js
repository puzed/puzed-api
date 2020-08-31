const postgres = require('postgres-fp/promises');

const deployRepositoryToServer = require('../../../common/deployRepositoryToServer');
const authenticate = require('../../../common/authenticate');

async function createDeployment ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const project = await postgres.getOne(db, `
    SELECT *
      FROM projects
     WHERE user_id = $1 AND id = $2
 `, [user.id, tokens.projectId]);

  if (!project) {
    throw Object.assign(new Error('project not found'), { statusCode: 404 });
  }

  await deployRepositoryToServer({ db, config }, project, {
    onOutput: function (deploymentId, data) {
      response.write(JSON.stringify([deploymentId, data]) + '\n');
    }
  });

  response.end();
}

module.exports = createDeployment;
