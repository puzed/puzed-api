const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');

test('sessions > read > invalid data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const session = await axios(`${server.httpsUrl}/sessions/current`, {
    validateStatus: () => true,
    headers: {
      authorization: 'wrong'
    },
    method: 'get'
  });

  t.equal(session.status, 401);

  t.deepEqual(session.data, 'unauthorised');

  server.close();
});

test('sessions > read', async t => {
  t.plan(5);

  const server = await createServerForTest();

  await axios(`${server.httpsUrl}/users`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email: 'user@example.com',
      password: 'Password@11111'
    }
  });

  const session = await axios(`${server.httpsUrl}/sessions`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email: 'user@example.com',
      password: 'Password@11111'
    }
  });

  const readSession = await axios(`${server.httpsUrl}/sessions/current`, {
    validateStatus: () => true,
    headers: {
      authorization: session.data.secret
    },
    method: 'get'
  });

  t.ok(readSession.data.id);
  t.ok(readSession.data.dateCreated);
  t.ok(readSession.data.user);

  t.equal(readSession.status, 200);

  delete readSession.data.id;
  delete readSession.data.dateCreated;
  delete readSession.data.user;

  t.deepEqual(readSession.data, {
    userId: session.data.userId,
    secret: session.data.secret
  });

  server.close();
});
