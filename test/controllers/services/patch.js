const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');

const testForValidSession = require('../../helpers/testForValidSession');
const testForOwnership = require('../../helpers/testForOwnership');
const createTestService = require('../../helpers/createTestService');

test('controllers/services/patch > auth > valid session', testForValidSession({
  method: 'PUT',
  path: '/services/testId'
}));

test('controllers/services/patch > auth > only owned', testForOwnership({
  method: 'PUT',
  path: '/services/:resourceId',
  resource: 'services'
}));

test('controllers/services/patch > invalid data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const updateResponse = await axios(`${server.httpsUrl}/services/${service.id}`, {
    method: 'PATCH',
    headers: {
      authorization: session.secret
    },
    data: {
      wrongAdditionalField: 1
    },
    validateStatus: () => true
  });

  t.equal(updateResponse.status, 422);

  t.deepEqual(updateResponse.data, {
    error: {
      messages: ['wrongAdditionalField is not a valid key'],
      fields: { wrongAdditionalField: ['is not a valid key'] }
    }
  });

  server.close();
});

test('controllers/services/patch > valid but incorrect foreigns', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const updatedService = await axios(`${server.httpsUrl}/services/${service.id}`, {
    method: 'PATCH',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: 'noLink',
      providerRepositoryId: 'noRepo',
      image: 'noImage',
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

test('controllers/services/patch > valid partial data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const updatedService = await axios(`${server.httpsUrl}/services/${service.id}`, {
    method: 'PATCH',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'examplecahnged'
    },
    validateStatus: () => true
  });

  t.equal(updatedService.status, 200);
  t.ok(updatedService.data.id, 'returned service had an id');

  server.close();
});

test('controllers/services/patch > valid full data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await createTestService(server, session);

  const updatedService = await axios(`${server.httpsUrl}/services/${service.id}`, {
    method: 'PATCH',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: service.linkId,
      providerRepositoryId: 'http://localhost:8082/test.git',
      image: 'nodejs12',
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
