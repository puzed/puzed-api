const axios = require('axios');
const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');
const pickRandomServer = require('../../../../common/pickRandomServer');
const checkRelationalData = require('../../../../common/checkRelationalData');
const createNewInstance = require('../../../../common/createInstance');

async function createInstance (scope, request, response, tokens) {
  const { db, settings, config } = scope;
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

  await createNewInstance(scope, deployment)

  writeResponse(200, instance, response);
}

module.exports = createInstance;
