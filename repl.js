const repl = require('repl');

const createScope = require('./createScope');

const config = require('./config');

async function main () {
  const scope = await createScope({
    ...config,
    createDataNode: false
  });

  process.on('unhandledRejection', (error) => {
    console.log(error);
    const r = repl.start('> ');

    Object.assign(r.context, scope);
  });

  const r = repl.start('> ');

  Object.assign(r.context, scope);
}

main();
