const axios = require('axios');
const writeResponse = require('write-response');

const authenticate = require('../../../common/authenticate');
const checkRelationalData = require('../../../common/checkRelationalData');

async function deleteDeployment ({ db, settings, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const { deployment } = await checkRelationalData(db, {
    service: {
      id: tokens.serviceId,
      userId: user.id
    },
    deployment: {
      id: tokens.deploymentId
    }
  });

  const server = await db.getOne('servers', {
    query: {
      id: deployment.guardianServerId
    }
  });

  const instances = await db.getAll('instances', {
    query: {
      deploymentId: deployment.id
    }
  });

  await db.patch('deployments', {
    destroyed: true
  }, {
    query: {
      id: deployment.id
    }
  });

  const removeInstancesPromises = instances.map(instance => {
    return axios(`https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}`, {
      method: 'DELETE',
      headers: {
        host: settings.domains.api[0],
        'x-internal-secret': settings.secret
      }
    });
  });

  await Promise.all(removeInstancesPromises);

  await db.delete('deployments', {
    query: {
      id: deployment.id
    }
  });

  writeResponse(200, '', response);
}

module.exports = deleteDeployment;
