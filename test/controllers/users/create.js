const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');

test('users > create > invalid data', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const user = await axios(`${server.httpsUrl}/users`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email: 'notvalid',
      password: 'Password@11111',
      a: 1
    }
  });

  t.equal(user.status, 422);

  t.deepEqual(user.data, {
    error: {
      messages: ['a is not a valid key'],
      fields: {
        email: ['should contain an @ symbol'],
        a: ['is not a valid key']
      }
    }
  });

  server.close();
});

test('users > create', async t => {
  t.plan(4);

  const server = await createServerForTest();

  const user = await axios(`${server.httpsUrl}/users`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email: 'me@markwylde.com',
      password: 'Password@11111'
    }
  });

  t.equal(user.status, 201);
  t.ok(user.data.id);
  t.ok(user.data.dateCreated);

  delete user.data.id;
  delete user.data.dateCreated;

  t.deepEqual(user.data, {
    email: 'me@markwylde.com',
    allowedServiceCreate: null
  });

  server.close();
});
