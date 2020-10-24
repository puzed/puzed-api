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

test.skip('services > create > valid', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session, user } = await createUserAndSession(server, { allowedServiceCreate: true });

  const link = await server.db.post('links', {
    providerId: 'github',
    userId: user.id,
    externalUserId: 'none',
    config: {
      installationId: '0'
    },
    dateCreated: Date.now()
  });

  await server.db.post('domains', {
    domain: 'example.com',
    userId: user.id,
    verificationStatus: 'success',
    dateCreated: Date.now()
  });

  const networkRules = await server.db.post('networkRules', {
    title: 'None',
    userId: user.id,
    rules: [
      "'allow'"
    ],
    dateCreated: Date.now()
  });

  const service = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: link.id,
      providerRepositoryId: 'noRepo',
      image: 'nodejs12',
      runCommand: 'noCommand',
      networkRulesId: networkRules.id,
      domain: 'test.example.com'
    },
    validateStatus: () => true
  });

  t.equal(service.status, 201);
  t.ok(service.data.id, 'returned service had an id');

  server.close();
});
