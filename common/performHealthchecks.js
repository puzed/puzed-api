const axios = require('axios');

const hint = require('hinton');

async function instanceHealthChecks ({ db, notify, config }) {
  const instances = await db.getAll(`
    SELECT "instances"."id", "serverId", "hostname", "dockerPort", "status", "statusDate"
      FROM "instances"
 LEFT JOIN "servers" ON "servers"."id" = "instances"."serverId"
     WHERE "serverId" = $1
       AND "status" IN ('starting', 'unhealthy', 'healthy')
  `, [config.serverId]);

  const promises = instances.map(async instance => {
    try {
      await axios(`http://${instance.hostname}:${instance.dockerPort}/health`, {
        validateStatus: () => true
      });
      if (instance.status !== 'healthy') {
        notify.broadcast(instance.id);
        return db.run(`
          UPDATE "instances"
            SET "status" = 'healthy',
                "statusDate" = $2
          WHERE "id" = $1
        `, [instance.id, Date.now()]);
      }
    } catch (_) {
      if (instance.status === 'healthy') {
        notify.broadcast(instance.id);
        return db.run(`
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

async function deploymentHealthChecks ({ db, notify, config }) {
  const deployments = await db.getAll(`
   SELECT
    "deployments"."id",
    "deployments"."stable",
    (SELECT count(*) FROM "instances" WHERE "instances"."deploymentId" = "deployments"."id") as "totalInstances",
    (SELECT count(*) FROM "instances" WHERE "instances"."deploymentId" = "deployments"."id" AND "instances"."status" IN ('healthy', 'destroyed')) as "healthyInstances"
     FROM "deployments"
    WHERE "deployments"."guardianServerId" = $1
  `, [config.serverId]);

  for (const deployment of deployments) {
    if (deployment.stable && deployment.totalInstances !== deployment.healthyInstances) {
      await db.run(`
        UPDATE "deployments"
          SET "stable" = false
        WHERE "id" = $1
      `, [deployment.id]);

      notify.broadcast(deployment.id);
      return;
    }

    if (!deployment.stable && deployment.totalInstances === deployment.healthyInstances) {
      await db.run(`
        UPDATE "deployments"
          SET "stable" = true
        WHERE "id" = $1
      `, [deployment.id]);

      notify.broadcast(deployment.id);
      return;
    }
  }
}

module.exports = async function ({ db, notify, config }) {
  hint('puzed.healthchecks', 'starting healthcheck batch');
  instanceHealthChecks({ db, notify, config });
  deploymentHealthChecks({ db, notify, config });
};
