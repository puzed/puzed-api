const writeResponse = require('write-response');

const listNetworkRules = require('../../queries/networkRules/listNetworkRules');
const authenticate = require('../../common/authenticate');
const getLinkById = require('../../queries/links/getLinkById');

async function serviceSchemaController (scope, request, response) {
  const url = new URL(request.url, 'http://localhost');

  const { user } = await authenticate(scope, request.headers.authorization);

  const networkRules = await listNetworkRules(scope, user.id);
  const defaultNetworkRule = networkRules.find(networkRule => networkRule.default);

  const link = await getLinkById(scope, user.id, url.searchParams.get('linkId'));

  if (!link) {
    throw Object.assign(new Error('invalid linkId specified'), {
      statusCode: 422,
      message: {
        error: { messages: ['invalid linkId specified'] }
      }
    });
  }

  const formFields = [
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
      options: networkRules.map(networkRule => ({
        value: networkRule.id,
        label: networkRule.title
      })),
      initialValue: defaultNetworkRule && defaultNetworkRule.id
    },
    {
      name: 'domain',
      label: 'Domain',
      component: 'textInput',
      initialValue: 'example.puzed.com'
    }
  ];

  const provider = link && scope.providers[link.providerId];
  const finalFields = await (provider && provider.getFormFields && provider.getFormFields(scope, user.id, formFields));

  writeResponse(200, finalFields || formFields, response);
}

module.exports = serviceSchemaController;
