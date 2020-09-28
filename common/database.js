const pg = require('pg-promise')();

async function connect (options) {
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
