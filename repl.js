const repl = require('repl');

const createScope = require('./createScope');

const config = require('./config');

async function main () {
  const scope = await createScope(config);

  const r = repl.start('> ');

  Object.assign(r.context, scope);
}

main();
