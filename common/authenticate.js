const axios = require('axios');
const uuidv4 = require('uuid').v4;
const memoize = require('memoizee');

const postgres = require('postgres-fp/promises');

const getGithubUser = memoize((githubUrl, authorization) => {
  return axios(githubUrl + '/user', {
    headers: {
      authorization
    }
  });
}, { maxAge: 60000, preFetch: true });

async function authenticate ({ db, config }, authorization) {
  if (!authorization) {
    throw Object.assign(new Error('unauthorized'), { statusCode: 401 });
  }

  const githubUser = await getGithubUser(config.githubApiUrl, authorization);

  const userRecord = await postgres.getOne(db, 'SELECT * FROM users WHERE "githubUsername" = $1', [githubUser.data.login]);
  if (!userRecord) {
    await postgres.insert(db, 'users', {
      id: uuidv4(),
      githubUsername: githubUser.data.login,
      allowedProjectCreate: false,
      dateCreated: Date.now()
    });
  }

  return {
    ...userRecord,
    githubUser: githubUser.data
  };
}

module.exports = authenticate;
