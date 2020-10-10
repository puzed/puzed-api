const validateAgainstSchema = require('../common/validateAgainstSchema');

function validateDomain (data) {
  const schema = {
    domain: [
      value => !value && 'is required'
    ]
  };

  return validateAgainstSchema(schema, data);
}

module.exports = validateDomain;
