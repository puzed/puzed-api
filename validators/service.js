const validateAgainstSchema = require('../common/validateAgainstSchema');

const validSubdomain = new RegExp('^[a-z0-9-]+$');

function validateService ({ validDomains }, data) {
  const validDomain = validDomains.find(domain => data.domain.endsWith(domain.domain));

  const subDomain = validDomain && validDomain.domain ? data.domain.slice(0, -validDomain.domain.length) : '';

  const schema = {
    name: [
      value => !value && 'is required',
      value => value && value.length < 3 && 'should be greater than 3 characters'
    ],

    linkId: [
      value => !value && 'is required'
    ],

    providerRepositoryId: [
      value => !value && 'is required'
    ],

    image: [
      value => !value && 'is required'
    ],

    environmentVariables: [],

    secrets: [],

    buildCommand: [],

    runCommand: [
      value => !value && 'is required'
    ],

    webPort: [
      value => value && isNaN(value) && 'must be a number'
    ],

    allowInternetAccess: [
      value => value && typeof value !== 'boolean' && 'must be a boolean'
    ],

    domain: [
      value => !value && 'is required',
      value => subDomain && !subDomain.slice(0, -1).match(validSubdomain) && 'should be a valid subdomain',
      value => subDomain && subDomain.slice(-1) !== '.' && 'should have a dot between the subdomain and domain',
      value => subDomain && subDomain.includes('--') && 'subdomain can not contain more than one dash (-) in a row',
      value => value && value.startsWith('-') && 'can not start with a dash (-)',
      value => value && value.endsWith('-') && 'can not end with a dash (-)',
      value => value && !validDomain && 'must be from a verified domain you have access to'
    ]
  };

  return validateAgainstSchema(schema, data);
}

module.exports = validateService;
