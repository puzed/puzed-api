const createScope = require('./createScope');
const createServer = require('./createServer');

const config = require('./config');

createScope(config)
  .then(scope => {
    createServer(scope);
  });
