const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');

test('providers > list',
  async t => {
    t.plan(2);

    const server = await createServerForTest();

    server.insert('providers', {
      id: 'test',
      driver: 'test',
      apiUrl: 'https://test',
      appId: '1',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      clientKey: 'test-client-key'
    });

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
