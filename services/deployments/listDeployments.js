async function listDeployments ({ db }, userId, serviceId) {
  const deployments = await db.getAll(`
      SELECT "deployments".*, 
      (
        SELECT count(*) 
          FROM "instances"
        WHERE "instances"."deploymentId" = "deployments"."id"
          AND "instances"."status" NOT IN ('destroyed')
      ) as "instanceCount"
    FROM "deployments"
    LEFT JOIN "services" ON "services"."id" = "deployments"."serviceId"
    WHERE "services"."userId" = $1
      AND "services"."id" = $2
    ORDER BY "deployments"."dateCreated" ASC
  `, [userId, serviceId]);

  if (deployments.length === 0) {
    return [];
  }

  const production = deployments.find(deployment => deployment.title === 'production');
  const deploymentsWithoutProduction = deployments.filter(deployment => deployment.title !== 'production');

  return [
    production,
    ...deploymentsWithoutProduction
  ];
}

module.exports = listDeployments;
