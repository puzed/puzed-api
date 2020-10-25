const axios = require('axios');

const createServerForTest = require('./createServerForTest');
const createUserAndSession = require('./createUserAndSession');

function testForOwnership (options) {
  return async t => {
    t.plan(4);

    const server = await createServerForTest();

    const ownerPromise = createUserAndSession(server, { allowedServiceCreate: true });
    const notOwnerPromise = createUserAndSession(server, { allowedServiceCreate: true });
    const [owner, notOwner] = await Promise.all([ownerPromise, notOwnerPromise]);

    const resource = await server.db.post(options.resource, {
      userId: owner.user.id
    });

    const ownerRequestPromise = axios(`${server.httpsUrl}${options.path.replace(':resourceId', resource.id)}`, {
      method: options.method,
      headers: {
        authorization: owner.session.secret
      },
      data: {},
      validateStatus: () => true
    });

    const notOwnerRequestPromise = axios(`${server.httpsUrl}${options.path.replace(':resourceId', resource.id)}`, {
      method: options.method,
      headers: {
        authorization: notOwner.session.secret
      },
      data: {},
      validateStatus: () => true
    });

    const [ownerRequest, notOwnerRequest] = await Promise.all([ownerRequestPromise, notOwnerRequestPromise]);

    t.equal(notOwnerRequest.status, 404);
    t.equal(notOwnerRequest.data, 'resource not be found');
    t.notEqual(ownerRequest.status, 404);
    t.notEqual(ownerRequest.data, 'resource not be found');

    server.close();
  };
}

module.exports = testForOwnership;
