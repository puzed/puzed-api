const axios = require('axios');
const uuidv4 = require('uuid').v4;

const postgres = require('postgres-fp/promises');

async function authenticate ({ db, config }, authorization) {
  if (!authorization) {
    throw Object.assign(new Error('unauthorized'), { statusCode: 401 });
  }

  const githubUser = await axios(config.githubApiUrl + '/user', {
    headers: {
      authorization
    }
  });

  const userRecord = await postgres.getOne(db, 'SELECT * FROM users WHERE github_username = $1', [githubUser.data.login]);
  if (!userRecord) {
    await postgres.insert(db, 'users', {
      id: uuidv4(),
      github_username: githubUser.data.login,
      allowed_project_create: false,
      date_created: Date.now()
    });
  }

  return {
    ...userRecord,
    githubUser: githubUser.data
  };
}

module.exports = authenticate;
