async function listDeployments ({ db }, userId, projectId) {
  const deployments = await db.getAll(`
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
    ORDER BY "deployments"."dateCreated" ASC
  `, [userId, projectId]);

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
