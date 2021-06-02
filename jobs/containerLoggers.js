const http = require('http');

const hint = require('hinton');
const finalStream = require('final-stream');

const activeWatchers = {};

const BUFFER_1 = Buffer.from([1]);

async function performContainerLoggers (scope) {
  hint('puzed.containerLoggers', 'starting containerLoggers batch');

  const { db, config, metrics } = scope;

  const instances = await db.getAll('instances', {
    query: {
      serverId: config.serverId,
      status: {
        $nin: ['failed', 'destroyed']
      }
    },
    fields: ['dockerId']
  });

  instances.forEach(async instance => {
    if (activeWatchers[instance.id]) {
      return;
    }

    const lastLog = await db.getOne(`instanceLogs-${instance.id}`, {
      fields: ['dateCreated'],
      order: ['desc(dateCreated)']
    });

    const since = lastLog ? parseInt(lastLog.dateCreated / 1000) : 0;

    metrics.inc('jobs/containerLoggers.js:37');
    const request = http.request({
      method: 'get',
      socketPath: config.dockerSocketPath,
      path: `/v1.40/containers/${instance.dockerId}/logs?follow=true&stdout=true&stderr=true&timestamps=true&since=${since}`
    }, function (response) {
      if (response.statusCode === 200) {
        response.on('data', buffer => {
          metrics.inc('jobs/containerLoggers.js:45');
          scope.db.post(`instanceLogs-${instance.id}`, {
            instanceId: instance.id,
            type: buffer.slice(1).equals(BUFFER_1) ? 'stdout' : 'stderr',
            data: buffer.slice(8).toString('utf8'),
            dateCreated: Date.now()
          });
        });
      } else {
        metrics.inc('jobs/containerLoggers.js:54');
        finalStream(response).then(data => console.log(data.toString()));
        delete activeWatchers[instance.id];
        request.end();
      }

      response.on('end', () => {
        metrics.inc('jobs/containerLoggers.js:61');
        delete activeWatchers[instance.id];
      });
    });

    request.on('error', () => {
      metrics.inc('jobs/containerLoggers.js:67');
      delete activeWatchers[instance.id];
    });

    request.end();

    activeWatchers[instance.id] = request;
  });
}

module.exports = performContainerLoggers;
