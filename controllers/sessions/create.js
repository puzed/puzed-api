const uuid = require('uuid').v4;
const writeResponse = require('write-response');
const finalStream = require('final-stream');
const verifyHash = require('pbkdf2-wrapper/verifyHash');

const validateUser = require('../../validators/user');
const buildInsertStatement = require('../../common/buildInsertStatement');
const createRandomString = require('../../common/createRandomString');

async function createSession ({ db, config }, request, response, tokens) {
  const body = await finalStream(request)
    .then(buffer => buffer.toString('utf8'))
    .then(JSON.parse);

  const validationErrors = validateUser(body);

  if (validationErrors) {
    throw Object.assign(new Error('invalid user data'), {
      statusCode: 422,
      message: {
        error: validationErrors
      }
    });
  }

  const user = await db.getOne(`
    SELECT *
      FROM "users"
     WHERE "email" = $1
  `, [body.email]);

  if (!user) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  if (!user.password) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  if (!await verifyHash(body.password, user.password)) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  const sessionId = uuid();

  const record = {
    id: sessionId,
    userId: user.id,
    secret: await createRandomString(42),
    dateCreated: Date.now()
  };

  const statement = buildInsertStatement('sessions', record);
  await db.run(statement.sql, statement.parameters);

  writeResponse(201, record, response);
}

module.exports = createSession;
