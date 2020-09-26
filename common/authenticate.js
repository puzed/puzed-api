const axios = require('axios');
const uuidv4 = require('uuid').v4;
const memoize = require('memoizee');

const buildInsertStatement = require('../common/buildInsertStatement');

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

  const userRecord = await db.getOne('SELECT * FROM users WHERE "githubUsername" = $1', [githubUser.data.login]);
  if (!userRecord) {
    const statement = buildInsertStatement('users', {
      id: uuidv4(),
      githubUsername: githubUser.data.login,
      allowedProjectCreate: false,
      dateCreated: Date.now()
    });
    await db.none(statement.sql, statement.parameters);
  }

  return {
    ...userRecord,
    githubUser: githubUser.data
  };
}

module.exports = authenticate;
