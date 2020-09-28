const validateAgainstSchema = require('../common/validateAgainstSchema');

function validateUser (data) {
  const schema = {
    email: [
      value => !value && 'is required',
      value => value && !value.includes('@') && 'should contain an @ symbol'
    ],

    password: [
      value => !value && 'is required',
      value => value && value.length < 5 && 'should be greater than 5 characters'
    ]
  };

  return validateAgainstSchema(schema, data);
}

module.exports = validateUser;
