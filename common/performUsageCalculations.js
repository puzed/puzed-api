const http = require('http');
const uuid = require('uuid').v4;

const hint = require('hinton');
const buildInsertStatement = require('./buildInsertStatement');

const activeWatchers = {};

const statisticAccumulator = {};

async function applyStatistic ({ db }, data) {
  const oldAccumulator = statisticAccumulator[data.instanceId];
  statisticAccumulator[data.instanceId] = data;

  if (oldAccumulator && oldAccumulator.cpuPercent > data.cpuPercent) {
    data.cpuPercent = oldAccumulator.cpuPercent;
  }

  if (oldAccumulator && oldAccumulator.cpu > data.cpu) {
    data.cpu = oldAccumulator.cpu;
  }

  if (oldAccumulator) {
    data.ticks = oldAccumulator.ticks + 1;
  } else {
    data.ticks = 0;
  }

  if (data.ticks > 10) {
    delete data.ticks;

    const lastCollectedStat = (await db.getOne(`
      SELECT *
        FROM "instanceStatistics"
      WHERE "instanceId" = $1
    ORDER BY "dateCreated" DESC
      LIMIT 1
    `, [data.instanceId])) || {
      cpu: 0,
      cpuTotal: 0,
      diskIo: 0,
      diskIoTotal: 0
    };

    data.cpu = data.cpuTotal - lastCollectedStat.cpuTotal;
    data.diskIo = data.diskIoTotal - lastCollectedStat.diskIoTotal;

    const statement = buildInsertStatement('instanceStatistics', {
      id: uuid(),
      ...data,
      dateCreated: Date.now()
    });

    await db.run(statement.sql, statement.parameters);

    delete statisticAccumulator[data.instanceId];
  }
}

async function handleStatResponse (scope, instance, stats) {
  if (!stats.cpu_stats || !stats.blkio_stats || !stats.memory_stats) {
    return;
  }

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

  applyStatistic(scope, {
    instanceId: instance.id,
    cpuTotal: statsRaw.cpuTotal,
    cpuPercent,
    diskIoTotal: statsRaw.diskIoTotal,
    memory: stats.memory_stats.usage
  });
}

async function performUsageCalculations (scope, instanceId) {
  hint('puzed.usageCalculations', 'starting usageCalculations batch');

  const { db, config } = scope;

  const instances = await db.getAll(`
    SELECT "instances"."id", "serverId", "hostname", "dockerId", "dockerPort", "status", "statusDate"
      FROM "instances"
  LEFT JOIN "servers" ON "servers"."id" = "instances"."serverId"
      WHERE "serverId" = $1
        AND "status" NOT IN ('failed', 'destroyed')
        AND ($2 IS NULL OR "instances"."id" = $2)
  `, [config.serverId, instanceId || null]);

  instances.forEach(async instance => {
    if (activeWatchers[instance.id]) {
      return;
    }

    activeWatchers[instance.id] = true;

    http.request({
      method: 'get',
      socketPath: '/var/run/docker.sock',
      path: `/v1.40/containers/${instance.dockerId}/stats?stream=true`
    }, function (response) {
      if (response.statusCode === 200) {
        response.on('data', buffer => {
          handleStatResponse(scope, instance, JSON.parse(buffer.toString('utf8')));
        });
      }

      response.on('end', () => {
        delete activeWatchers[instance.id];
      });
    }).end();
  });
}

module.exports = performUsageCalculations;
