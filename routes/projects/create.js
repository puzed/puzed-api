const { promisify } = require('util');

const uuidv4 = require('uuid').v4;
const finalStream = promisify(require('final-stream'));
const writeResponse = require('write-response');
const axios = require('axios');
const postgres = require('postgres-fp/promises');
const NodeRSA = require('node-rsa');

const deployRepositoryToServer = require('../../common/deployRepositoryToServer');
const handleError = require('../../common/handleError');

function ensureDeployKeyOnProject (config, owner, repo, publicKey, authorization) {
  return axios({
    url: `${config.githubApiUrl}/repos/${owner}/${repo}/keys`,
    method: 'post',
    headers: {
      authorization: authorization
    },
    data: JSON.stringify({
      key: publicKey.trim()
    })
  }).catch(error => {
    if (!error.response || !error.response.data || !error.response.data.errors) {
      throw error;
    }

    if (error.response.data.errors.length === 1 && error.response.data.errors[0].message === 'key is already in use') {
      return error.response;
    }

    throw error;
  });
}

async function createProject ({ db, config }, request, response) {
  if (!request.headers.authorization) {
    throw Object.assign(new Error('unauthorized'), {statusCode: 401})
  }

  const body = await finalStream(request, JSON.parse);

  const user = await axios(`${config.githubApiUrl}/user`, {
    headers: {
      authorization: request.headers.authorization
    }
  });

  const key = new NodeRSA({ b: 2048 }, 'openssh');

  const publicKey = key.exportKey('openssh-public');
  const privateKey = key.exportKey('openssh');

  const projectId = uuidv4();

  await postgres.insert(db, 'projects', {
    id: projectId,
    name: body.name,
    image: body.image,
    webport: body.webport,
    domain: body.domain,
    owner: body.owner,
    repo: body.repo,
    publicKey,
    privateKey,
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

  await ensureDeployKeyOnProject(config, body.owner, body.repo, publicKey, request.headers.authorization);

  await deployRepositoryToServer({ db, config }, project, {
    onOutput: function (data) {
      response.write(data)
    }
  });

  response.end();
}

module.exports = createProject;
