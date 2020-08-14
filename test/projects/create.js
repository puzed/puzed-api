const test = require('tape');
const axios = require('axios');
const writeResponse = require('write-response');

const createServerForTest = require('../helpers/createServerForTest');
const createGithubMockServer = require('../helpers/createGithubMockServer');

test('projects > create > valid item', async t => {
  t.plan(1);

  const githubMockServer = await createGithubMockServer({
    '/user': {
      GET: function (request, response) {
        writeResponse(200, {
          login: 'testuser',
          id: 5000000
        }, response);
      }
    },

    '/repos/exampleowner/exampleproject/keys': {
      POST: function (request, response) {
        writeResponse(200, {}, response);
      }
    }
  });
  const server = await createServerForTest({ githubApiUrl: githubMockServer.url });

  const projects = await axios(`${server.url}/projects`, {
    method: 'post',
    data: {
      domain: 'example.com',
      name: 'exampleowner/exampleproject',
      owner: 'exampleowner',
      repo: 'exampleproject',
      username: 'exampleowner',
      webport: 8080
    },
    headers: {
      authorization: 'token test'
    }
  });

  delete projects.data.id;

  t.deepEqual(projects.data, {
    name: 'exampleowner/exampleproject',
    webport: '8080',
    domain: 'example.com',
    owner: 'exampleowner',
    repo: 'exampleproject',
    username: 'testuser'
  });

  server.close();
  githubMockServer.close();
});
