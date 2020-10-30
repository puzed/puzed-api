const test = require('tape');
const axios = require('axios');

const createServerForTest = require('../helpers/createServerForTest');
const createUserAndSession = require('../helpers/createUserAndSession');
const createTestService = require('../helpers/createTestService');
const createDockerMockServer = require('../helpers/createDockerMockServer');
const createGenericMockServer = require('../helpers/createGenericMockServer');
const healthchecks = require('../../jobs/healthchecks');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function createInstanceFullJourney (server, session) {
  const service = await createTestService(server, session);
  const deployment = await server.db.getOne('deployments');
  const instance = await axios(`${server.httpsUrl}/services/${service.id}/deployments/${deployment.id}/instances`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {},
    validateStatus: () => true
  });

  return {
    service,
    deployment,
    instance: instance.data,
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

  await sleep(500);

  await healthchecks(server.scope);

  const instanceRefresh = await axios(`${server.httpsUrl}/services/${service.id}/deployments/${deployment.id}/instances/${instance.id}`, {
    headers: {
      authorization: session.secret
    },
    validateStatus: () => true
  });

  t.equal(instanceRefresh.data.status, 'healthy');

  server.close();
  dockerMock.close();
  instanceMock.close();
});
