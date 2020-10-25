const axios = require('axios');

const createServerForTest = require('./createServerForTest');
const createUserAndSession = require('./createUserAndSession');

function testForValidSession (options) {
  return async t => {
    t.plan(5);

    const server = await createServerForTest();

    const { session } = await createUserAndSession(server);

    const serviceMissingSession = await axios(`${server.httpsUrl}${options.path}`, {
      method: options.method,
      validateStatus: () => true
    });

    const serviceInvalidSession = await axios(`${server.httpsUrl}${options.path}`, {
      method: options.method,
      headers: {
        authorization: 'wrong'
      },
      validateStatus: () => true
    });

    const serviceValidSession = await axios(`${server.httpsUrl}${options.path}`, {
      method: options.method,
      headers: {
        authorization: session.secret
      },
      validateStatus: () => true
    });

    t.equal(serviceMissingSession.status, 401, 'missing session errors');
    t.equal(serviceInvalidSession.status, 401, 'invalid session errors');
    t.notEqual(serviceValidSession.status, 401, 'valid session works');

    t.deepEqual(serviceMissingSession.data, 'unauthorised', 'missing session returns unauthorised message');
    t.deepEqual(serviceInvalidSession.data, 'unauthorised', 'invalid session returns unauthorised message');

    server.close();
  };
}

module.exports = testForValidSession;
