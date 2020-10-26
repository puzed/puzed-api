const test = require('tape-catch');
const axios = require('axios');

const createServerForTest = require('../../helpers/createServerForTest');
const createUserAndSession = require('../../helpers/createUserAndSession');
const testForValidSession = require('../../helpers/testForValidSession');

test('schema/service > auth > valid session', testForValidSession({
  method: 'GET',
  path: '/schema/service'
}));

test('schema > invalid link', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { session } = await createUserAndSession(server);

  const service = await axios(`${server.httpsUrl}/schema/service?linkId=unknown`, {
    headers: {
      authorization: session.secret
    },
    validateStatus: () => true
  });

  t.equal(service.status, 422);

  t.deepEqual(service.data, {
    error: {
      messages: ['invalid linkId specified']
    }
  });

  server.close();
});

test('schema > service', async t => {
  t.plan(2);

  const server = await createServerForTest();

  const { user, session } = await createUserAndSession(server);

  const link = await server.db.post('links', {
    providerId: 'github',
    userId: user.id,
    config: {
      installationId: '0'
    },
    dateCreated: Date.now()
  });

  const networkRule = await server.db.post('networkRules', {
    title: 'None',
    rules: [
      "'allow'"
    ],
    dateCreated: Date.now()
  });

  const service = await axios(`${server.httpsUrl}/schema/service?linkId=${link.id}`, {
    headers: {
      authorization: session.secret
    },
    validateStatus: () => true
  });

  t.equal(service.status, 200);

  t.deepEqual(service.data, [
    {
      name: 'providerRepositoryId',
      label: 'Source Code Repository',
      component: 'repositorySelector'
    },
    {
      name: 'name',
      label: 'Service Name',
      component: 'textInput',
      autoFocus: true
    },
    {
      name: 'image',
      label: 'Image',
      component: 'select',
      options: [
        {
          value: 'nodejs12',
          label: 'NodeJS (version 12)'
        }
      ],
      initialValue: 'nodejs12'
    },
    {
      name: 'memory',
      label: 'Memory Limit',
      component: 'select',
      options: [
        {
          value: 100,
          label: '100mb'
        },
        {
          value: 250,
          label: '250mb'
        },
        {
          value: 500,
          label: '500mb'
        },
        {
          value: 750,
          label: '750mb'
        },
        {
          value: 1000,
          label: '1gb'
        },
        {
          value: 2000,
          label: '2gb'
        },
        {
          value: 4000,
          label: '4gb'
        }
      ],
      initialValue: 500
    },
    {
      name: 'environmentVariables',
      label: 'Environment Variables',
      component: 'multilineInput'
    },
    {
      name: 'secrets',
      label: 'Secrets',
      prefix: '/run/secrets/',
      component: 'filePicker',
      multiple: true
    },
    {
      name: 'buildCommand',
      label: 'Build command',
      component: 'textInput',
      initialValue: 'npm install'
    },
    {
      name: 'runCommand',
      label: 'Run command',
      component: 'textInput',
      initialValue: 'npm run start'
    },
    {
      name: 'webPort',
      label: 'Web Port',
      component: 'textInput',
      initialValue: '8000'
    },
    {
      name: 'networkRulesId',
      label: 'Network Access Level',
      component: 'select',
      options: [
        {
          value: networkRule.id,
          label: 'None'
        }
      ]
    },
    {
      name: 'domain',
      label: 'Domain',
      component: 'textInput',
      initialValue: 'example.puzed.com'
    }
  ]);

  server.close();
});
