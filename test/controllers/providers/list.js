const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');

test('providers > list',
  async t => {
    t.plan(2);

    const server = await createServerForTest();

    const provider = await server.db.post('providers', {
      title: 'Test',
      driver: 'test',
      apiUrl: 'https://test',
      appId: '1',
      installUrl: 'https://install',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      clientKey: 'test-client-key',
      ssoEnabled: false
    });

    const providers = await axios(`${server.httpsUrl}/providers`, {
      validateStatus: () => true
    });

    t.equal(providers.status, 200);
    t.deepEqual(providers.data, [{
      id: provider.id,
      title: 'Test',
      driver: 'test',
      appId: '1',
      installUrl: 'https://install',
      clientId: 'test-client-id',
      ssoEnabled: false
    }]);

    server.close();
  });
