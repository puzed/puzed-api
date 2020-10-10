const uuid = require('uuid').v4;

const buildInsertStatement = require('../../common/buildInsertStatement');
const createRandomString = require('../../common/createRandomString');

async function createSession ({ db }, userId) {
  const sessionId = uuid();
  const secret = await createRandomString(42);

  const record = {
    id: sessionId,
    userId: userId,
    secret,
    dateCreated: Date.now()
  };

  const statement = buildInsertStatement('sessions', record);
  await db.run(statement.sql, statement.parameters);

  return record;
}

module.exports = createSession;
