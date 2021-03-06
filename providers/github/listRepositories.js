const axios = require('axios');
const generateAccessToken = require('./generateAccessToken');

const memoizee = require('memoizee');

async function listRepositories (scope, userId, linkId) {
  const { db } = scope;

  const link = await db.getOne('links', {
    query: {
      id: linkId,
      userId: userId
    }
  });

  if (!link) {
    throw Object.assign(new Error('no link'), { statusCode: 404 });
  }

  const accessToken = await generateAccessToken(scope, link.config.installationId);

  const firstRepositoriesResponse = await axios({
    url: 'https://api.github.com/installation/repositories?page=1&per_page=100',
    headers: {
      authorization: 'token ' + accessToken
    }
  });

  const responsesPromises = [firstRepositoriesResponse];

  const pages = Math.ceil(firstRepositoriesResponse.data.total_count / 100);
  for (let pageNumber = 2; pageNumber < pages + 1; pageNumber++) {
    const repositoriesResponse = axios({
      url: `https://api.github.com/installation/repositories?page=${pageNumber}&per_page=100`,
      headers: {
        authorization: 'token ' + accessToken
      }
    });

    responsesPromises.push(repositoriesResponse);
  }

  const responses = await Promise.all(responsesPromises);

  return responses.map(response => response.data.repositories).flat();
}

module.exports = memoizee(listRepositories, { maxAge: 60000 });
