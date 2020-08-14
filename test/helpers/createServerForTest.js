const postgres = require('postgres-fp/promises');

const config = require('../../config');
const createServer = require('../../createServer');

async function wipe () {
  const db = await postgres.connect(config.cockroach);
  await postgres.run(db, `
    DROP TABLE IF EXISTS projects;
  `);
  await postgres.close(db);

  process.testHasWipedDatabase = true;
}

async function clean () {
  const db = await postgres.connect(config.cockroach);

  await postgres.run(db, `
    DELETE FROM test;
  `).catch(error => {
    if (!error.message.includes('does not exist')) {
      throw error;
    }
  });

  await postgres.close(db);
}

async function createServerForTest (configOverrides) {
  if (process.testHasWipedDatabase) {
    await clean();
  } else {
    await wipe();
  }

  const server = await createServer({
    ...config,
    ...configOverrides
  });

  return new Promise(resolve => {
    server.on('listening', () => {
      resolve({
        url: 'http://localhost:' + server.address().port,
        close: server.close.bind(server)
      });
    });
    server.listen();
  });
}

module.exports = createServerForTest;
