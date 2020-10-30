const writeResponse = require('write-response');

const authenticate = require('../../common/authenticate');
const checkRelationalData = require('../../common/checkRelationalData');

async function readInstance ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const { instance } = await checkRelationalData(db, {
    service: {
      id: tokens.serviceId,
      userId: user.id
    },
    deployment: {
      id: tokens.deploymentId
    },
    instance: {
      id: tokens.instanceId
    }
  });

  writeResponse(200, instance, response);
}

module.exports = readInstance;
