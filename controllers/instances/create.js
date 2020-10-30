const writeResponse = require('write-response');

const authenticate = require('../../common/authenticate');
const checkRelationalData = require('../../common/checkRelationalData');
const createNewInstance = require('../../common/createNewInstance');

async function createInstance (scope, request, response, tokens) {
  const { db, config } = scope;
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

  const instance = await createNewInstance(scope, deployment.id);

  writeResponse(200, instance, response);
}

module.exports = createInstance;
