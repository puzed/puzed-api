const config = require('./config');

const createServer = require('./createServer');
createServer(config).then(server => {
  server.on('listening', () => {
    console.log(`listening on ${server.address().port}`);
  });
  server.listen(3000);
});
