const axios = require('axios');
const uuid = require('uuid').v4;

async function createUserAndSession (server, userOverrides = {}) {
  const email = userOverrides.email || uuid() + '@example.com';

  const user = await axios(`${server.httpsUrl}/users`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email,
      password: 'Password@11111'
    }
  });

  await server.db.patch('users', userOverrides, {
    query: {
      id: user.data.id
    }
  });

  const session = await axios(`${server.httpsUrl}/sessions`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email,
      password: 'Password@11111'
    }
  });

  return {
    user: user.data,
    session: session.data
  };
}

module.exports = createUserAndSession;
