const axios = require('axios');
const uuid = require('uuid').v4;

const hint = require('hinton');
const buildInsertStatement = require('./buildInsertStatement');

async function performUsageCalculations ({ db, notify, config }, instanceId) {
  hint('puzed.usageCalculations', 'starting usageCalculations batch');

  const instances = await db.getAll(`
    SELECT "instances"."id", "serverId", "hostname", "dockerId", "dockerPort", "status", "statusDate"
      FROM "instances"
  LEFT JOIN "servers" ON "servers"."id" = "instances"."serverId"
      WHERE "serverId" = $1
        AND "status" NOT IN ('failed', 'destroyed')
        AND ($2 IS NULL OR "instances"."id" = $2)
  `, [config.serverId, instanceId || null]);

  const promises = instances.map(async instance => {
    const statsResponse = await axios({
      method: 'get',
      socketPath: '/var/run/docker.sock',
      validateStatus: () => true,
      url: `/v1.40/containers/${instance.dockerId}/stats?stream=false`
    });

    if (statsResponse.status !== 200) {
      return;
    }

    const stats = statsResponse.data;
    if (!stats.cpu_stats || !stats.blkio_stats || !stats.memory_stats) {
      return;
    }

    const lastCollectedStat = (await db.getOne(`
      SELECT *
        FROM "instanceStatistics"
       WHERE "instanceId" = $1
    ORDER BY "dateCreated" DESC
       LIMIT 1
    `, [instance.id])) || {
      cpu: 0,
      cpuTotal: 0,
      diskIo: 0,
      diskIoTotal: 0
    };

    let cpuPercent = 0;

    const previousCPU = stats.precpu_stats.cpu_usage.total_usage;
    const previousSystem = stats.precpu_stats.system_cpu_usage;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - previousCPU;
    const systemDelta = stats.cpu_stats.system_cpu_usage - previousSystem;
    let onlineCPUs = stats.cpu_stats.online_cpus;

    if (onlineCPUs === 0) {
      onlineCPUs = stats.cpu_stats.cpu_usage.percpu_usage.length;
    }
    if (systemDelta > 0 && cpuDelta > 0) {
      cpuPercent = (cpuDelta / systemDelta) * onlineCPUs * 100;
    }

    const statsRaw = {
      cpuTotal: stats.cpu_stats.cpu_usage.total_usage,
      diskIoTotal: stats.blkio_stats.io_service_bytes_recursive.find(serviceByte => serviceByte.op === 'Total').value,
      memory: stats.memory_stats.usage
    };

    const statement = buildInsertStatement('instanceStatistics', {
      id: uuid(),
      instanceId: instance.id,
      cpuTotal: statsRaw.cpuTotal,
      cpuPercent,
      cpu: statsRaw.cpuTotal - lastCollectedStat.cpuTotal,
      diskIoTotal: statsRaw.diskIoTotal,
      diskIo: statsRaw.diskIoTotal - lastCollectedStat.diskIoTotal,
      memory: stats.memory_stats.usage,
      dateCreated: Date.now()
    });

    await db.run(statement.sql, statement.parameters);
  });

  await Promise.all(promises);
}

module.exports = performUsageCalculations;
