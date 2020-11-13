const test = require('tape');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');
const prepareGenericSetup = require('../../helpers/prepareGenericSetup');
const testForValidSession = require('../../helpers/testForValidSession');

test('controllers/services/create > auth > valid session', testForValidSession({
  method: 'POST',
  path: '/services'
}));

test('services > create > invalid session', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const service = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
    validateStatus: () => true
  });

  t.equal(service.status, 401);

  t.deepEqual(service.data, 'unauthorised');

  server.close();
});

test('services > create > no allowedServiceCreate permission', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server);

  const service = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    validateStatus: () => true
  });

  t.equal(service.status, 422);

  t.deepEqual(service.data, { error: { messages: ['You do not have permission to create services'] } });

  server.close();
});

test('services > create > invalid data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {},
    validateStatus: () => true
  });

  t.equal(service.status, 422);

  t.deepEqual(service.data, {
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

test('services > create > valid but incorrect foreigns', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const service = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
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

  t.equal(service.status, 422);

  t.deepEqual(service.data, {
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

test('services > create > valid', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const { link, networkRules } = await prepareGenericSetup(server);

  const service = await axios(`${server.httpsUrl}/services`, {
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

  await server.close();

  t.equal(service.status, 201);
  t.ok(service.data.id, 'returned service had an id');
});
