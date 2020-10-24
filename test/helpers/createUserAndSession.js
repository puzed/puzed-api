const axios = require('axios');

async function createUserAndSession (server, userOverrides = {}) {
  const user = await axios(`${server.httpsUrl}/users`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email: 'user@example.com',
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
      email: 'user@example.com',
      password: 'Password@11111'
    }
  });

  return {
    user: user.data,
    session: session.data
  };
}

module.exports = createUserAndSession;
