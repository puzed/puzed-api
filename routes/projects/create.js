const { promisify } = require('util');

const uuidv4 = require('uuid').v4;
const finalStream = promisify(require('final-stream'));
const axios = require('axios');

const authenticate = require('../../common/authenticate');
const buildInsertStatement = require('../../common/buildInsertStatement');
const presentProject = require('../../presenters/project');

async function createProject ({ db, config }, request, response) {
  request.setTimeout(60 * 60 * 1000);

  const { user } = await authenticate({ db, config }, request.headers.authorization);

  if (!user.allowedProjectCreate) {
    response.writeHead(403);
    response.end('no permission to create projects');
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

  const projectId = uuidv4();

  const statement = buildInsertStatement('projects', {
    id: projectId,
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

  await axios(`https://localhost:${config.httpsPort}/projects/${projectId}/deployments`, {
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

  const project = await db.getOne(`
    SELECT * FROM projects WHERE id = $1
  `, [projectId]);

  response.statusCode = 200;
  response.write(JSON.stringify(presentProject(project), response));

  response.end();
}

module.exports = createProject;
