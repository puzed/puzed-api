const { promisify } = require('util');
const crypto = require('crypto');
const randomBytes = promisify(crypto.randomBytes);

const createSecureRandomString = async ({ length, type = 'hex' }) => {
  const result = await randomBytes(length);
  return result.toString(type);
};

module.exports = createSecureRandomString;
