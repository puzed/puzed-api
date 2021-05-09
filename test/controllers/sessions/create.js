const test = require('basictap');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');

test('sessions > create > invalid data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const session = await axios(`${server.httpsUrl}/sessions`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email: 'not@existing',
      password: 'Password@11111'
    }
  });

  t.equal(session.status, 401);

  t.deepEqual(session.data, 'unauthorised');

  server.close();
});

test('sessions > create', async t => {
  t.plan(5);

  const server = await createServerForTest();

  const user = await axios(`${server.httpsUrl}/users`, {
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

  t.equal(session.status, 201);

  t.ok(session.data.id);
  t.ok(session.data.secret);
  t.ok(session.data.dateCreated);

  delete session.data.id;
  delete session.data.secret;
  delete session.data.dateCreated;

  t.deepEqual(session.data, {
    userId: user.data.id
  });

  server.close();
});
