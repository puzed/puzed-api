const axios = require('axios');

const prepareGenericSetup = require('./prepareGenericSetup');

async function createTestService (server, session) {
  const { link, networkRules } = await prepareGenericSetup(server);

  const serviceResponse = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: link.id,
      providerRepositoryId: 'http://localhost:8082/test.git',
      image: 'nodejs12',
      memory: 500,
      runCommand: 'noCommand',
      networkRulesId: networkRules.id,
      domain: 'test.example.com'
    },
    validateStatus: () => true
  });

  return serviceResponse.data;
}

module.exports = createTestService;
