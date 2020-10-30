const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');
const testForValidSession = require('../../helpers/testForValidSession');
const createTestService = require('../../helpers/createTestService');

test('controllers/services/deployments/delete > auth > valid session', testForValidSession({
  method: 'DELETE',
  path: '/services/:serviceId/deployments/:deploymentId'
}));

test('controllers/services/deployments/delete > success', async t => {
  t.plan(1);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const deploymentCreationResponse = await axios(`${server.httpsUrl}/services/${service.id}/deployments`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {},
    validateStatus: () => true
  });
  const deployment = deploymentCreationResponse.data;

  const deploymentDeletionResponse = await axios(`${server.httpsUrl}/services/${service.id}/deployments/${deployment.id}`, {
    method: 'DELETE',
    headers: {
      authorization: session.secret
    },
    data: {},
    validateStatus: () => true
  });

  t.equal(deploymentDeletionResponse.status, 200);

  server.close();
});
