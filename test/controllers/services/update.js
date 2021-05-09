const test = require('basictap');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');
const prepareGenericSetup = require('../../helpers/prepareGenericSetup');

const testForValidSession = require('../../helpers/testForValidSession');
const testForOwnership = require('../../helpers/testForOwnership');

async function createTestService (server, session) {
  const { link, networkRules } = await prepareGenericSetup(server);

  const serviceResponse = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: link.id,
      providerRepositoryId: 'http://localhost:8082/test.git',
      image: 'alpine.nodejs12',
      memory: 500,
      runCommand: 'noCommand',
      networkRulesId: networkRules.id,
      domain: 'test.example.com'
    },
    validateStatus: () => true
  });

  return serviceResponse.data;
}

test('controllers/services/update > auth > valid session', testForValidSession({
  method: 'PUT',
  path: '/services/testId'
}));

test('controllers/services/update > auth > only owned', testForOwnership({
  method: 'PUT',
  path: '/services/:resourceId',
  resource: 'services'
}));

test('controllers/services/update > invalid data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const updateResponse = await axios(`${server.httpsUrl}/services/${service.id}`, {
    method: 'PUT',
    headers: {
      authorization: session.secret
    },
    data: {},
    validateStatus: () => true
  });

  t.equal(updateResponse.status, 422);

  t.deepEqual(updateResponse.data, {
    error: {
      messages: [],
      fields: {
        name: ['is required'],
        linkId: ['is required'],
        providerRepositoryId: ['is required'],
        image: ['is required'],
        memory: ['is required'],
        runCommand: ['is required'],
        networkRulesId: ['is required'],
        domain: ['is required']
      }
    }
  });

  server.close();
});

test('controllers/services/update > valid but incorrect foreigns', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const updatedService = await axios(`${server.httpsUrl}/services/${service.id}`, {
    method: 'PUT',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: 'noLink',
      providerRepositoryId: 'noRepo',
      image: 'noImage',
      memory: 500,
      runCommand: 'noCommand',
      networkRulesId: 'noNetwork',
      domain: 'wrong'
    },
    validateStatus: () => true
  });

  t.equal(updatedService.status, 422);

  t.deepEqual(updatedService.data, {
    error: {
      messages: [],
      fields: {
        linkId: ['does not exist'],
        image: ['does not exist'],
        networkRulesId: ['does not exist'],
        domain: ['must be from a verified domain you have access to']
      }
    }
  });

  server.close();
});

test('controllers/services/update > valid', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const updatedService = await axios(`${server.httpsUrl}/services/${service.id}`, {
    method: 'PUT',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: service.linkId,
      providerRepositoryId: 'http://localhost:8082/test.git',
      image: 'alpine.nodejs12',
      memory: 500,
      runCommand: 'noCommand',
      networkRulesId: service.networkRulesId,
      domain: 'test.example.com'
    },
    validateStatus: () => true
  });

  t.equal(updatedService.status, 200);
  t.ok(updatedService.data.id, 'returned service had an id');

  server.close();
});
