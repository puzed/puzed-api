const cryptoRandomString = require('crypto-random-string');

function createRandomString (length) {
  return cryptoRandomString({ length, type: 'alphanumeric' });
}

module.exports = createRandomString;
