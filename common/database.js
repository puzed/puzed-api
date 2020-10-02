const fs = require('fs');
const path = require('path');

const pg = require('pg-promise')();
const waitOn = require('wait-on');

async function connect (options) {
  console.log('Waiting for the database to be configured and running...');
  await waitOn({
    resources: [
      path.resolve(options.ssl.caFile),
      path.resolve(options.ssl.keyFile),
      path.resolve(options.ssl.certFile),
      `tcp:${options.host}:${options.port}`
    ],
    window: 1
  });
  console.log('Ready!');

  options.ssl.ca = fs.readFileSync(path.resolve(options.ssl.caFile));
  options.ssl.key = fs.readFileSync(path.resolve(options.ssl.keyFile));
  options.ssl.cert = fs.readFileSync(path.resolve(options.ssl.certFile));

  const pgp = pg(options);

  return {
    getOne: pgp.oneOrNone.bind(pgp),
    getAll: pgp.manyOrNone.bind(pgp),
    run: pgp.any.bind(pgp),
    close: pgp.$pool.end.bind(pgp)
  };
}

module.exports = {
  connect
};
