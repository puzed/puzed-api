const { promisify } = require('util');

const uuidv4 = require('uuid').v4;
const finalStream = promisify(require('final-stream'));
const writeResponse = require('write-response');
const axios = require('axios');
const postgres = require('postgres-fp/promises');

const handleError = require('../../common/handleError');

function ensureDeployKeyOnProject (config, owner, repo, authorization) {
  return axios({
    url: `${config.githubApiUrl}/repos/${owner}/${repo}/keys`,
    method: 'post',
    headers: {
      authorization: authorization
    },
    data: JSON.stringify({
      key: config.rsaPublicKey
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
  try {
    const body = await finalStream(request, JSON.parse);

    const user = await axios(`${config.githubApiUrl}/user`, {
      headers: {
        authorization: request.headers.authorization
      }
    });

    ensureDeployKeyOnProject(config, body.owner, body.repo, request.headers.authorization);

    const projectId = uuidv4();

    await postgres.run(db, `
      INSERT INTO projects (
        id,
        name,
        webport,
        domain,
        owner,
        repo,
        username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      projectId,
      body.name,
      body.webport,
      body.domain,
      body.owner,
      body.repo,
      user.data.login
    ]);

    const projects = await postgres.getOne(db, `
      SELECT * FROM projects WHERE id = $1
    `, [projectId]);

    writeResponse(200, projects, response);
  } catch (error) {
    handleError(error, request, response);
  }
}

module.exports = createProject;
