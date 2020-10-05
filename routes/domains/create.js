const uuid = require('uuid').v4;
const writeResponse = require('write-response');
const finalStream = require('final-stream');

const buildInsertStatement = require('../../common/buildInsertStatement');
const createRandomString = require('../../common/createRandomString');
const pickRandomServer = require('../../common/pickRandomServer');
const presentDomain = require('../../presenters/domain');
// const validateDomain = require('../../validators/domain');

async function createDomain ({ db, settings, config }, request, response, tokens) {
  const body = await finalStream(request)
    .then(buffer => buffer.toString('utf8'))
    .then(JSON.parse);

  // const validationErrors = validateDomain(body);

  // if (validationErrors) {
  //   throw Object.assign(new Error('invalid domain data'), {
  //     statusCode: 422,
  //     message: {
  //       error: validationErrors
  //     }
  //   });
  // }

  const domainId = uuid();
  const guardianServer = await pickRandomServer({ db });

  const statement = buildInsertStatement('domains', {
    id: domainId,
    domain: body.domain,
    guardianServerId: guardianServer.id,
    verificationCode: await createRandomString(30),
    dateCreated: Date.now()
  });
  await db.run(statement.sql, statement.parameters);

  const domainResult = await db.getOne(`
  SELECT *
    FROM "domains"
   WHERE "id" = $1
`, [domainId]);

  writeResponse(201, presentDomain(domainResult), response);
}

module.exports = createDomain;
