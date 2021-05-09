const test = require('basictap');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');
const testForValidSession = require('../../helpers/testForValidSession');

test('controllers/networkRules/list > auth > valid session', testForValidSession({
  method: 'GET',
  path: '/networkRules'
}));

test('networkRules > unauthorised', async t => {
  t.plan(1);

  const server = await createServerForTest();

  const networkRules = await axios(`${server.httpsUrl}/networkRules`, {
    validateStatus: () => true
  });

  t.equal(networkRules.status, 401);

  server.close();
});

test('networkRules > list', async t => {
  t.plan(3);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server);

  await server.db.post('networkRules', {
    title: 'Test',
    default: true,
    userId: null,
    rules: [
      'deny'
    ],
    dateCreated: Date.now()
  });

  const networkRules = await axios(`${server.httpsUrl}/networkRules`, {
    headers: {
      authorization: session.secret
    },
    validateStatus: () => true
  });

  t.equal(networkRules.status, 200);

  const networkRule = networkRules.data.find(networkRule => networkRule.title === 'Test');

  t.ok(networkRule);

  t.deepEqual(networkRule, {
    id: networkRule.id ? networkRule.id : t.fail(),
    title: 'Test',
    rules: [
      'deny'
    ],
    default: true,
    userId: null,
    dateCreated: networkRule.dateCreated ? networkRule.dateCreated : t.fail()
  });

  server.close();
});
