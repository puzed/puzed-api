const { promisify } = require('util');

const uuid = require('uuid').v4;
const writeResponse = require('write-response');
const finalStream = promisify(require('final-stream'));
const hashText = require('pbkdf2-wrapper/hashText');

const buildInsertStatement = require('../../common/buildInsertStatement');
const presentUser = require('../../presenters/user');
const validateUser = require('../../validators/user');

async function createUser ({ db, settings, config }, request, response, tokens) {
  const body = await finalStream(request).then(JSON.parse);

  const existingUser = await db.getOne(`
    SELECT *
      FROM "users"
     WHERE "email" = $1
  `, [body.email]);

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

  const userId = uuid();

  const passwordHash = await hashText(body.password, settings.hashConfig);

  const statement = buildInsertStatement('users', {
    id: userId,
    email: body.email,
    password: passwordHash,
    dateCreated: Date.now()
  });
  await db.run(statement.sql, statement.parameters);

  const userResult = await db.getOne(`
  SELECT *
    FROM "users"
   WHERE "id" = $1
`, [userId]);

  writeResponse(201, presentUser(userResult), response);
}

module.exports = createUser;
