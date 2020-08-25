const { promisify } = require('util');

const uuidv4 = require('uuid').v4;
const finalStream = promisify(require('final-stream'));
const axios = require('axios');
const postgres = require('postgres-fp/promises');
const NodeRSA = require('node-rsa');

const authenticate = require('../../common/authenticate');
const deployRepositoryToServer = require('../../common/deployRepositoryToServer');

async function ensureDeployKeyOnProject ({ db, config }, owner, repo, authorization) {
  const deployKey = await postgres.getOne(db, `
    SELECT * FROM github_deployment_keys WHERE owner = $1 AND repo = $2
  `, [owner, repo]);

  if (!deployKey) {
    const key = new NodeRSA({ b: 2048 }, 'openssh');

    const publicKey = key.exportKey('openssh-public');
    const privateKey = key.exportKey('openssh');

    const creationResponse = await axios({
      url: `${config.githubApiUrl}/repos/${owner}/${repo}/keys`,
      method: 'post',
      headers: {
        authorization
      },
      data: JSON.stringify({
        key: publicKey.trim()
      })
    });

    await postgres.insert(db, 'github_deployment_keys', {
      id: uuidv4(),
      github_key_id: creationResponse.data.id,
      owner,
      repo,
      publicKey,
      privateKey
    });

    return;
  }

  await axios({
    url: `${config.githubApiUrl}/repos/${owner}/${repo}/keys/${deployKey.github_key_id}`,
    headers: {
      authorization
    }
  }).catch(error => {
    if (error.response.status === 404) {
      return postgres.run(db, 'DELETE FROM github_deployment_keys WHERE id = $1', [deployKey.id])
        .then(() => ensureDeployKeyOnProject({ db, config }, owner, repo, authorization));
    }

    console.log(error);
  });
}

async function createProject ({ db, config }, request, response) {
  const user = await authenticate({ db, config }, request.headers.authorization);

  if (!user.allowed_project_create) {
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
    })
  }

  if (config.domains.client.includes(body.domain)) {
    throw Object.assign(new Error('Validation error'), {
      statusCode: 422,
      body: {
        errors: [`domain of "${body.domain}" is already taken`]
      }
    })
  }

  const projectId = uuidv4();

  await postgres.insert(db, 'projects', {
    id: projectId,
    name: body.name,
    image: body.image,
    webport: body.webport,
    domain: body.domain,
    owner: body.owner,
    repo: body.repo,
    run_command: body.runCommand,
    build_command: body.buildCommand,
    user_id: user.id,
    datecreated: Date.now()
  });

  const project = await postgres.getOne(db, `
    SELECT * FROM projects WHERE id = $1
  `, [projectId]);

  response.statusCode = 200;
  response.write(JSON.stringify({
    ...project,
    privatekey: undefined
  }));

  await ensureDeployKeyOnProject({ db, config }, body.owner, body.repo, request.headers.authorization);

  await Promise.all([
    deployRepositoryToServer({ db, config }, project, {
      onOutput: function (deploymentId, data) {
        response.write(JSON.stringify([deploymentId, data]) + '\n');
      }
    })

    // deployRepositoryToServer({ db, config }, project, {
    //   onOutput: function (deploymentId, data) {
    //     response.write(JSON.stringify([deploymentId, data]) + '\n');
    //   }
    // })
  ]);

  response.end();
}

module.exports = createProject;
