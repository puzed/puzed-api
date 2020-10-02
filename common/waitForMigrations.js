function waitForMigrations (db) {
  process.stdout.write('  Waiting for migrations to complete');

  let lastError;
  let intervalReference;
  let timeoutReference;

  return new Promise((resolve, reject) => {
    intervalReference = setInterval(async () => {
      process.stdout.write('.');

      const migrations = await db.getAll('SELECT * FROM "_migrations"')
        .catch(error => {
          lastError = error;
        });

      if (migrations && migrations.length > 0) {
        clearTimeout(intervalReference);
        clearTimeout(timeoutReference);
        console.log('.');
        resolve();
      }
    }, 100);

    timeoutReference = setTimeout(() => {
      clearTimeout(intervalReference);
      reject(lastError);
    }, 10000);
  });
}

module.exports = waitForMigrations;
