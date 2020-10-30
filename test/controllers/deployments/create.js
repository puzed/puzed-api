const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');
const testForValidSession = require('../../helpers/testForValidSession');
const createTestService = require('../../helpers/createTestService');

test('controllers/services/deployments/create > auth > valid session', testForValidSession({
  method: 'POST',
  path: '/services/:serviceId/deployments'
}));

test('controllers/services/deployments/create > success', async t => {
  t.plan(9);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const deployment = await axios(`${server.httpsUrl}/services/${service.id}/deployments`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {},
    validateStatus: () => true
  });

  t.equal(deployment.status, 200);
  t.ok(deployment.data.id, 'deployment had id');
  t.ok(deployment.data.serviceId, 'deployment had serviceId');
  t.ok(deployment.data.dateCreated, 'deployment had dateCreated');
  t.equal(deployment.data.branch, 'master');
  t.equal(deployment.data.commitHash, '');
  t.equal(deployment.data.guardianServerId, server.scope.config.serverId);
  t.equal(deployment.data.totalInstances, 0);
  t.equal(deployment.data.healthyInstances, 0);

  server.close();
});
