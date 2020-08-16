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

    '/repos/markwylde/minthril-demo/keys': {
      POST: function (request, response) {
        writeResponse(200, {}, response);
      }
    }
  });
  const server = await createServerForTest({ githubApiUrl: githubMockServer.url });

  const projects = await axios(`${server.url}/projects`, {
    method: 'post',
    data: {
      image: 'node:12',
      domain: 'example.com',
      name: 'markwylde/minthril-demo',
      owner: 'markwylde',
      repo: 'minthril-demo',
      username: 'markwylde',
      webport: 8000
    },
    headers: {
      authorization: 'token test'
    }
  });

  delete projects.data.id;

  t.deepEqual(projects.data, {
    name: 'markwylde/minthril-demo',
    image: 'node:12',
    webport: '8000',
    domain: 'example.com',
    owner: 'markwylde',
    repo: 'minthril-demo',
    username: 'testuser'
  });

  server.close();
  githubMockServer.close();
});
