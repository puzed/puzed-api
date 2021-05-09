const test = require('basictap');
const axios = require('axios');

const createServerForTest = require('../helpers/createServerForTest');
const createUserAndSession = require('../helpers/createUserAndSession');
const createTestService = require('../helpers/createTestService');
const createDockerMockServer = require('../helpers/createDockerMockServer');
const createGenericMockServer = require('../helpers/createGenericMockServer');
const healthchecks = require('../../jobs/healthchecks');

async function createInstanceFullJourney (server, session) {
  const service = await createTestService(server, session);
  const deployment = await server.db.getOne('deployments');

  const createdInstance = await axios(`${server.httpsUrl}/services/${service.id}/deployments/${deployment.id}/instances`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {},
    validateStatus: () => true
  });

  await server.db.patch('instances', { status: 'unhealthy', dockerPort: 8082 });
  const instance = await server.db.getOne('instances', { query: { id: createdInstance.data.id } });

  return {
    service,
    deployment,
    instance,
    session
  };
}

test('instance turns healthy', async t => {
  t.plan(1);

  const server = await createServerForTest();
  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });
  const dockerMock = await createDockerMockServer();
  const instanceMock = await createGenericMockServer(8082);

  const { service, deployment, instance } = await createInstanceFullJourney(server, session);

  await healthchecks(server.scope);

  const instanceRefresh = await axios(`${server.httpsUrl}/services/${service.id}/deployments/${deployment.id}/instances/${instance.id}`, {
    headers: {
      authorization: session.secret
    },
    validateStatus: () => true
  });

  server.close();
  dockerMock.close();
  instanceMock.close();

  t.equal(instanceRefresh.data.status, 'healthy');
});
