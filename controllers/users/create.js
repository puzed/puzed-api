const writeResponse = require('write-response');
const finalStream = require('final-stream');
const hashText = require('pbkdf2-wrapper/hashText');

const presentUser = require('../../presenters/user');
const validateUser = require('../../validators/user');

async function createUser ({ db, settings, config }, request, response, tokens) {
  const body = await finalStream(request)
    .then(buffer => buffer.toString('utf8'))
    .then(JSON.parse);

  const existingUser = await db.getOne('users', {
    query: {
      email: body.email
    }
  });

  if (existingUser) {
    throw Object.assign(new Error('user with email already exists'), { statusCode: 422 });
  }

  const validationErrors = validateUser(body);

  if (validationErrors) {
    throw Object.assign(new Error('invalid user data'), {
      statusCode: 422,
      message: {
        error: validationErrors
      }
    });
  }

  const passwordHash = await hashText(body.password, settings.hashConfig);

  const userResult = await db.post('users', {
    email: body.email,
    password: passwordHash,
    allowedServiceCreate: false,
    dateCreated: Date.now()
  });

  writeResponse(201, presentUser(userResult), response);
}

module.exports = createUser;
