const http = require('http');

const hint = require('hinton');
const finalStream = require('final-stream');

const activeWatchers = {};

const BUFFER_1 = Buffer.from([1]);

async function performContainerLoggers (scope) {
  hint('puzed.containerLoggers', 'starting containerLoggers batch');

  const { db, config } = scope;

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
      limit: 1,
      order: ['desc(dateCreated)']
    });

    const since = lastLog ? parseInt(lastLog.dateCreated / 1000) : 0;

    const request = http.request({
      method: 'get',
      socketPath: config.dockerSocketPath,
      path: `/v1.40/containers/${instance.dockerId}/logs?follow=true&stdout=true&stderr=true&timestamps=true&since=${since}`
    }, function (response) {
      if (response.statusCode === 200) {
        response.on('data', buffer => {
          scope.db.post(`instanceLogs-${instance.id}`, {
            instanceId: instance.id,
            type: buffer.slice(1).equals(BUFFER_1) ? 'stdout' : 'stderr',
            data: buffer.slice(8).toString('utf8'),
            dateCreated: Date.now()
          });
        });
      } else {
        finalStream(response).then(data => console.log(data.toString()));
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

module.exports = performContainerLoggers;
