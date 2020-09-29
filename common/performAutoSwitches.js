const hint = require('../modules/hint');

async function performAutoSwitches ({ db, notify, config }) {
  hint('puzed.healthchecks', 'starting autoswitches batch');

  const deployments = await db.getAll(`
   SELECT *
     FROM "deployments"
    WHERE "guardianServerId" = $1
      AND "autoSwitch" IS NOT NULL
  `, [config.serverId]);

  for (const deployment of deployments) {
    if (deployment.stable) {
      const targetDeployment = await db.getOne(`
        SELECT *
          FROM "deployments"
        WHERE "serviceId" = $1
          AND "title" = $2
      `, [deployment.serviceId, deployment.autoSwitch.targetDeployment]);

      await db.run(`
        UPDATE "deployments"
           SET "title" = $2
         WHERE "id" = $1
      `, [targetDeployment.id, deployment.autoSwitch.newTitle]);

      await db.run(`
        UPDATE "deployments"
           SET "autoSwitch" = NULL,
               "title" = $2
         WHERE "id" = $1
      `, [deployment.id, deployment.autoSwitch.targetDeployment]);

      notify.broadcast(deployment.id);
      notify.broadcast(targetDeployment.id);
      return;
    }
  }
}

module.exports = performAutoSwitches;
