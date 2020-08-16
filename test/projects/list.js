const test = require('tape');
const axios = require('axios');
const writeResponse = require('write-response');

const createServerForTest = require('../helpers/createServerForTest');
const createGithubMockServer = require('../helpers/createGithubMockServer');

test('projects > list > no items', async t => {
  t.plan(1);

  const githubMockServer = await createGithubMockServer({
    '/user': {
      GET: function (request, response) {
        writeResponse(200, {
          login: 'testuser',
          id: 5000000
        }, response);
      }
    }
  });
  const server = await createServerForTest({ githubApiUrl: githubMockServer.url });

  const projects = await axios(`${server.url}/projects`, {
    headers: {
      authorization: 'token test'
    }
  });

  t.deepEqual(projects.data, []);

  server.close();
  githubMockServer.close();
});

test('projects > list > with items', async t => {
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

  await axios(`${server.url}/projects`, {
    method: 'post',
    data: {
      domain: 'example.com',
      name: 'exampleowner/exampleproject',
      image: 'node:12',
      owner: 'exampleowner',
      repo: 'exampleproject',
      username: 'exampleowner',
      webport: 8080
    },
    headers: {
      authorization: 'token test'
    }
  });

  const projects = await axios(`${server.url}/projects`, {
    headers: {
      authorization: 'token test'
    }
  });

  delete projects.data[0].id;
  t.deepEqual(projects.data[0], {
    name: 'exampleowner/exampleproject',
    image: 'node:12',
    webport: '8080',
    domain: 'example.com',
    owner: 'exampleowner',
    repo: 'exampleproject',
    username: 'testuser'
  });

  server.close();
  githubMockServer.close();
});
