const writeResponse = require('write-response');
const postgres = require('postgres-fp/promises');

const authenticate = require('../../../common/authenticate');

async function listDeployments ({ db, config }, request, response, tokens) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  const deployments = await postgres.getAll(db, `
    SELECT deployments.*
      FROM deployments
 LEFT JOIN projects ON deployments.projectid = projects.id
     WHERE user_id = $1 AND projectid = $2
  `, [user.id, tokens.projectId]);

  writeResponse(200, deployments, response);
}

module.exports = listDeployments;
