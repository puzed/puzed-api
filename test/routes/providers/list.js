const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');

test('providers > list',
  async t => {
    t.plan(2);

    const server = await createServerForTest();

    const session = await axios(`${server.httpsUrl}/providers`, {
      validateStatus: () => true
    });

    t.equal(session.status, 200);
    t.deepEqual(session.data, [{
      id: 'test',
      driver: 'test',
      appId: '1',
      clientId: 'test-client-id'
    }]);

    server.close();
  });
