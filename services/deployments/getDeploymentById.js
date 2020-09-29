async function getDeploymentById ({ db }, userId, serviceId, deploymentId) {
  const deployment = await db.getOne(`
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
      AND "deployments"."id" = $3
    ORDER BY "deployments"."dateCreated" ASC
  `, [userId, serviceId, deploymentId]);

  return deployment;
}

module.exports = getDeploymentById;
