const axios = require('axios');
const postgres = require('postgres-fp/promises');

const hint = require('../modules/hint');

async function performHealthchecks ({ db, notify, config }) {
  hint('puzed.healthchecks', 'starting healthcheck batch');

  const instances = await postgres.getAll(db, `
    SELECT "id", "dockerHost", "dockerPort", "status", "statusDate"
      FROM "instances"
     WHERE "dockerHost" = ANY ($1)
       AND "status" IN ('starting', 'unhealthy', 'healthy')
  `, [config.responsibilities]);

  const promises = instances.map(async instance => {
    try {
      await axios(`http://${instance.dockerHost}:${instance.dockerPort}/health`, {
        validateStatus: () => true
      });
      if (instance.status !== 'healthy') {
        notify.broadcast(instance.id);
        return postgres.run(db, `
          UPDATE "instances"
            SET "status" = 'healthy',
                "statusDate" = $2
          WHERE "id" = $1
        `, [instance.id, Date.now()]);
      }
    } catch (_) {
      if (instance.status === 'healthy') {
        notify.broadcast(instance.id);
        return postgres.run(db, `
          UPDATE "instances"
            SET "status" = 'unhealthy',
                "statusDate" = $2
          WHERE "id" = $1
        `, [instance.id, Date.now()]);
      }
    }
  });

  await Promise.all(promises);
}

module.exports = performHealthchecks;
