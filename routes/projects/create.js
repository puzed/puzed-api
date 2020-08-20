const { promisify } = require('util');

const uuidv4 = require('uuid').v4;
const finalStream = promisify(require('final-stream'));
const axios = require('axios');
const postgres = require('postgres-fp/promises');
const NodeRSA = require('node-rsa');

const deployRepositoryToServer = require('../../common/deployRepositoryToServer');

async function ensureDeployKeyOnProject ({ db, config }, owner, repo, publicKey, authorization) {
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
        authorization: authorization
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
    method: 'post',
    headers: {
      authorization: authorization
    },
    data: JSON.stringify({
      key: publicKey.trim()
    })
  }).catch(error => {
    console.log(error);

    postgres.run(db, 'DELETE FROM github_deployment_keys WHERE id = $1', [deployKey.id]);
  });
}

async function createProject ({ db, config }, request, response) {
  if (!request.headers.authorization) {
    throw Object.assign(new Error('unauthorized'), { statusCode: 401 });
  }

  const body = await finalStream(request, JSON.parse);

  const user = await axios(`${config.githubApiUrl}/user`, {
    headers: {
      authorization: request.headers.authorization
    }
  });

  const projectId = uuidv4();

  await postgres.insert(db, 'projects', {
    id: projectId,
    name: body.name,
    image: body.image,
    webport: body.webport,
    domain: body.domain,
    owner: body.owner,
    repo: body.repo,
    username: user.data.login
  });

  const project = await postgres.getOne(db, `
    SELECT * FROM projects WHERE id = $1
  `, [projectId]);

  response.statusCode = 200;
  response.write(JSON.stringify({
    ...project,
    privatekey: undefined
  }, null, 2));
  response.write('\n\n---\n\n');

  await ensureDeployKeyOnProject(config, body.owner, body.repo, request.headers.authorization);

  await deployRepositoryToServer({ db, config }, project, {
    onOutput: function (data) {
      response.write(data);
    }
  });

  response.end();
}

module.exports = createProject;
