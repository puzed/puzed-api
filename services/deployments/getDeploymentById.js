async function getDeploymentById ({ db }, userId, projectId, deploymentId) {
  const deployment = await db.getOne(`
      SELECT "deployments".*, 
      (
        SELECT count(*) 
          FROM "instances"
        WHERE "instances"."deploymentId" = "deployments"."id"
          AND "instances"."status" NOT IN ('destroyed')
      ) as "instanceCount"
    FROM "deployments"
    LEFT JOIN "projects" ON "projects"."id" = "deployments"."projectId"
    WHERE "projects"."userId" = $1
      AND "projects"."id" = $2
      AND "deployments"."id" = $3
    ORDER BY "deployments"."dateCreated" ASC
  `, [userId, projectId, deploymentId]);

  return deployment;
}

module.exports = getDeploymentById;
