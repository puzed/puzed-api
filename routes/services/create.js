const { promisify } = require('util');

const uuidv4 = require('uuid').v4;
const finalStream = promisify(require('final-stream'));
const axios = require('axios');

const authenticate = require('../../common/authenticate');
const buildInsertStatement = require('../../common/buildInsertStatement');
const presentService = require('../../presenters/service');

async function createService ({ db, config }, request, response) {
  request.setTimeout(60 * 60 * 1000);

  const { user } = await authenticate({ db, config }, request.headers.authorization);

  if (!user.allowedServiceCreate) {
    response.writeHead(403);
    response.end('no permission to create services');
    return;
  }

  const body = await finalStream(request, JSON.parse);

  if (config.domains.api.includes(body.domain)) {
    throw Object.assign(new Error('Validation error'), {
      statusCode: 422,
      body: {
        errors: [`domain of "${body.domain}" is already taken`]
      }
    });
  }

  if (config.domains.client.includes(body.domain)) {
    throw Object.assign(new Error('Validation error'), {
      statusCode: 422,
      body: {
        errors: [`domain of "${body.domain}" is already taken`]
      }
    });
  }

  const serviceId = uuidv4();

  const statement = buildInsertStatement('services', {
    id: serviceId,
    name: body.name,
    provider: body.provider,
    providerRepositoryId: body.providerRepositoryId,
    image: body.image,
    webPort: body.webPort,
    domain: body.domain,
    secrets: JSON.stringify(body.secrets),
    environmentVariables: body.environmentVariables,
    runCommand: body.runCommand,
    buildCommand: body.buildCommand,
    userId: user.id,
    dateCreated: Date.now()
  });
  await db.run(statement.sql, statement.parameters);

  await axios(`https://localhost:${config.httpsPort}/services/${serviceId}/deployments`, {
    method: 'POST',
    headers: {
      host: config.domains.api[0],
      authorization: request.headers.authorization
    },
    data: JSON.stringify({
      title: 'production',
      branch: 'master'
    })
  });

  const service = await db.getOne(`
    SELECT * FROM services WHERE id = $1
  `, [serviceId]);

  response.statusCode = 200;
  response.write(JSON.stringify(presentService(service), response));

  response.end();
}

module.exports = createService;
