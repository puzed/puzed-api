const axios = require('axios');
const postgres = require('postgres-fp/promises');

async function performHealthchecks ({ db, config }) {
  const deployments = await postgres.getAll(db, `
    SELECT *
      FROM "deployments"
     WHERE "dockerHost" = ANY ($1)
       AND "status" IN ('starting', 'unhealthy', 'healthy')
  `, [config.responsibilities]);

  const promises = deployments.map(async deployment => {
    await axios(`http://${deployment.dockerHost}:${deployment.dockerPort}/health`, {
      validateStatus: () => true
    }).catch(_ => {
      if (deployment.status === 'healthy') {
        return postgres.run(db, `
          UPDATE "deployments"
            SET "status" = 'unhealthy',
                "statusDate" = $2
          WHERE "id" = $1
        `, [deployment.id, Date.now()]);
      }
    }).then(() => {
      if (deployment.status !== 'healthy') {
        return postgres.run(db, `
          UPDATE "deployments"
            SET "status" = 'healthy',
                "statusDate" = $2
          WHERE "id" = $1
        `, [deployment.id, Date.now()]);
      }
    });
  });

  await Promise.all(promises);
}

module.exports = performHealthchecks;
