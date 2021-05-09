const writeResponse = require('write-response');
const finalStream = require('final-stream');

const authenticate = require('../../common/authenticate');

const createRandomString = require('../../common/createRandomString');
const pickRandomServer = require('../../common/pickRandomServer');
const presentDomain = require('../../presenters/domain');
const validateDomain = require('../../validators/domain');

async function createDomain ({ db, settings, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const body = await finalStream(request)
    .then(buffer => buffer.toString('utf8'))
    .then(JSON.parse);

  const validationErrors = await validateDomain(body);

  if (validationErrors) {
    throw Object.assign(new Error('invalid domain data'), {
      statusCode: 422,
      message: {
        error: validationErrors
      }
    });
  }

  const guardianServer = await pickRandomServer({ db });

  const domain = await db.post('domains', {
    domain: body.domain,
    userId: user.id,
    guardianServerId: guardianServer.id,
    verificationStatus: 'untested',
    verificationCode: await createRandomString({ length: 30 }),
    dateCreated: Date.now()
  });

  writeResponse(201, presentDomain(domain), response);
}

module.exports = createDomain;
