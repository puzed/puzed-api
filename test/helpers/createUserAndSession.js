const axios = require('axios');

async function createUserAndSession (server) {
  const user = await axios(`${server.httpsUrl}/users`, {
    validateStatus: () => true,
    method: 'post',
    data: {
      email: 'user@example.com',
      password: 'Password@11111'
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
