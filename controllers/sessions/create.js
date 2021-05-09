const writeResponse = require('write-response');
const finalStream = require('final-stream');
const verifyHash = require('pbkdf2-wrapper/verifyHash');

const validateUser = require('../../validators/user');
const createRandomString = require('../../common/createRandomString');

async function createSession ({ db, config }, request, response, tokens) {
  const body = await finalStream(request)
    .then(buffer => buffer.toString('utf8'))
    .then(JSON.parse);

  const validationErrors = await validateUser(body);

  if (validationErrors) {
    throw Object.assign(new Error('invalid user data'), {
      statusCode: 422,
      message: {
        error: validationErrors
      }
    });
  }

  const user = await db.getOne('users', {
    query: {
      email: body.email
    }
  });

  if (!user) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  if (!user.password) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  if (!await verifyHash(body.password, user.password)) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  const session = await db.post('sessions', {
    userId: user.id,
    secret: await createRandomString({ length: 42 }),
    dateCreated: Date.now()
  });

  writeResponse(201, session, response);
}

module.exports = createSession;
