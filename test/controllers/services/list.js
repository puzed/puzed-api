const test = require('tape');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');
const prepareGenericSetup = require('../../helpers/prepareGenericSetup');
const testForValidSession = require('../../helpers/testForValidSession');

test('controllers/services/list > auth > valid session', testForValidSession({
  method: 'GET',
  path: '/services'
}));

test('services > list > unauthorised', async t => {
  t.plan(1);

  const server = await createServerForTest();

  const services = await axios(`${server.httpsUrl}/services`, {
    validateStatus: () => true
  });

  t.equal(services.status, 401);

  server.close();
});

test('services > list', async t => {
  t.plan(10);

  const server = await createServerForTest();

  const { user, session } = await createUserAndSession(server, { allowedServiceCreate: true });

  const { link, networkRules } = await prepareGenericSetup(server);

  const serviceCreationResponse = await axios(`${server.httpsUrl}/services`, {
    method: 'POST',
    headers: {
      authorization: session.secret
    },
    data: {
      name: 'example',
      linkId: link.id,
      providerRepositoryId: 'http://localhost:8082/test.git',
      image: 'nodejs12',
      runCommand: 'noCommand',
      networkRulesId: networkRules.id,
      domain: 'test.example.com'
    },
    validateStatus: () => true
  });
  const service = serviceCreationResponse.data;

  const services = await axios(`${server.httpsUrl}/services`, {
    headers: {
      authorization: session.secret
    }
  });

  t.equal(services.status, 200);
  t.equal(services.data.length, 1);
  t.equal(services.data[0].id, service.id);
  t.equal(services.data[0].name, 'example');
  t.equal(services.data[0].linkId, link.id);
  t.equal(services.data[0].image, 'nodejs12');
  t.equal(services.data[0].domain, 'test.example.com');
  t.equal(services.data[0].runCommand, 'noCommand');
  t.equal(services.data[0].userId, user.id);
  t.ok(services.data[0].dateCreated, 'service had dateCreated');

  server.close();
});
