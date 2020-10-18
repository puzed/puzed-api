const createRandomString = require('../../common/createRandomString');

async function createSession ({ db }, userId) {
  const secret = await createRandomString(42);

  return db.post('sessions', {
    userId: userId,
    secret,
    dateCreated: Date.now()
  });
}

module.exports = createSession;
