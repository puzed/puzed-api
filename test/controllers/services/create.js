const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');

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
      runCommand: 'noCommand',
      networkRulesId: 'noNetwork',
      domains: 'wrong'
    },
    validateStatus: () => true
  });

  t.equal(service.status, 422);

  t.deepEqual(service.data, {
    error: {
      messages: ['domains is not a valid key'],
      fields: { domains: ['is not a valid key'], domain: ['is required'] }
    }
  });

  server.close();
});
