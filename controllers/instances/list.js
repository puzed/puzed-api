const writeResponse = require('write-response');

const authenticate = require('../../common/authenticate');
const checkRelationalData = require('../../common/checkRelationalData');

async function listInstances ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  await checkRelationalData(db, {
    service: {
      id: tokens.serviceId,
      userId: user.id
    },
    deployment: {
      id: tokens.deploymentId
    }
  });

  const instances = await db.getAll('instances', {
    query: {
      deploymentId: tokens.deploymentId
    },
    order: 'desc(dateCreated)',
    fields: ['serviceId', 'deploymentId', 'serverId', 'commitHash', 'status', 'dateCreated']
  });

  writeResponse(200, instances, response);
}

module.exports = listInstances;
