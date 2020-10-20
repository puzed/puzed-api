const http = require('http');
// const tidyRequest = require('tidy-http/tidyRequest');

const hint = require('hinton');

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

    const lastCollectedStat = (await db.getOne('instanceStatistics', {
      query: {
        instanceId: data.instanceId
      },
      order: 'desc(dateCreated)',
      limit: 1
    })) || {
      cpu: 0,
      cpuTotal: 0,
      diskIo: 0,
      diskIoTotal: 0
    };

    data.cpu = data.cpuTotal - lastCollectedStat.cpuTotal;
    data.diskIo = data.diskIoTotal - lastCollectedStat.diskIoTotal;

    await db.post('instanceStatistics', {
      ...data,
      dateCreated: Date.now()
    });

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

  const bytesRecursive = stats.blkio_stats.io_service_bytes_recursive && stats.blkio_stats.io_service_bytes_recursive.find(serviceByte => serviceByte.op === 'Total');

  const statsRaw = {
    cpuTotal: stats.cpu_stats.cpu_usage.total_usage,
    diskIoTotal: bytesRecursive && bytesRecursive.value,
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

  let instances;
  if (instanceId) {
    instances = await db.getAll('instances', {
      query: {
        id: instanceId
      },
      fields: ['dockerId']
    });
  } else {
    instances = await db.getAll('instances', {
      query: {
        serverId: config.serverId,
        status: {
          $nin: ['failed', 'destroyed']
        }
      },
      fields: ['dockerId']
    });
  }

  instances.forEach(async instance => {
    if (activeWatchers[instance.id]) {
      return;
    }

    const request = http.request({
      method: 'get',
      socketPath: '/var/run/docker.sock',
      path: `/v1.40/containers/${instance.dockerId}/stats?stream=true`
    }, function (response) {
      if (response.statusCode === 200) {
        response.on('data', buffer => {
          handleStatResponse(scope, instance, JSON.parse(buffer.toString('utf8')));
        });
      } else {
        delete activeWatchers[instance.id];
        request.end();
      }

      response.on('end', () => {
        delete activeWatchers[instance.id];
      });
    });

    request.on('error', () => {
      delete activeWatchers[instance.id];
    });

    request.end();

    activeWatchers[instance.id] = request;
  });
}

module.exports = performUsageCalculations;
