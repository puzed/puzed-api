const validateAgainstSchema = require('../common/validateAgainstSchema');
const listAvailableDomains = require('../queries/domains/listAvailableDomains');
const getLinkById = require('../queries/links/getLinkById');
const getNetworkRulesById = require('../queries/networkRules/getNetworkRulesById');

const validSubdomain = /^[a-z0-9-]+$/;

async function isDomainTaken ({ db, settings }, domain, existingService) {
  if (settings.domains.api.includes(domain) || settings.domains.client.includes(domain)) {
    return true;
  }

  if (existingService && existingService.domain === domain) {
    return false;
  }

  const service = await db.getOne('services', {
    query: {
      domain: domain.toLowerCase()
    }
  });

  if (service) {
    return true;
  }
}

async function validateService (scope, userId, existingService, data, skipRequired) {
  const validDomains = await listAvailableDomains(scope, userId);
  const validDomain = validDomains.find(domain => data.domain && data.domain.endsWith(domain.domain));

  const subDomain = validDomain && validDomain.domain ? data.domain.slice(0, -validDomain.domain.length) : '';

  const schema = {
    name: [
      value => !skipRequired && !value && 'is required',
      value => value && value.length < 3 && 'should be greater than 3 characters'
    ],

    linkId: [
      value => !skipRequired && !value && 'is required',
      async value => value && !(await getLinkById(scope, userId, value)) && 'does not exist'
    ],

    providerRepositoryId: [
      value => !skipRequired && !value && 'is required'
    ],

    image: [
      value => !skipRequired && !value && 'is required',
      value => value && !['linux.nodejs12', 'alpine.nodejs12', 'alpine.nodejs10', 'alpine.nodejs8'].includes(value) && 'does not exist'
    ],

    memory: [
      value => !skipRequired && !value && 'is required',
      value => value && isNaN(value) && 'must be a number'
    ],

    environmentVariables: [],

    secrets: [],

    buildCommand: [],

    runCommand: [
      value => !skipRequired && !value && 'is required'
    ],

    webPort: [
      value => value && isNaN(value) && 'must be a number'
    ],

    networkRulesId: [
      value => !skipRequired && !value && 'is required',
      async value => value && !(await getNetworkRulesById(scope, userId, value)) && 'does not exist'
    ],

    domain: [
      value => !skipRequired && !value && 'is required',
      value => subDomain && !subDomain.slice(0, -1).match(validSubdomain) && 'should be a valid subdomain',
      value => subDomain && subDomain.slice(-1) !== '.' && 'should have a dot between the subdomain and domain',
      value => subDomain && subDomain.includes('--') && 'subdomain can not contain more than one dash (-) in a row',
      value => value && value.startsWith('-') && 'can not start with a dash (-)',
      value => value && value.endsWith('-') && 'can not end with a dash (-)',
      value => value && !validDomain && 'must be from a verified domain you have access to',
      async value => value && (await isDomainTaken(scope, value, existingService)) && 'has already been used for another service'
    ]
  };

  return validateAgainstSchema(schema, data);
}

module.exports = validateService;
