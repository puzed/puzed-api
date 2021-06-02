const httpRequest = require('../common/httpRequest');
const hint = require('hinton');
const MAX_START_TIME = 10 * 1000;
const MAX_UNHEALTHY_TIME = 10 * 1000;

async function instanceDestroyChecks ({ db, notify, metrics, config }) {
  const instances = await db.getAll('instances', {
    query: {
      serverId: config.serverId,
      status: {
        $nin: ['queued', 'failed', 'destroyed', 'healthy']
      }
    },
    fields: ['dockerId']
  });

  const promises = instances
    .filter(instance => {
      return !!instance.dockerId;
    })
    .map(async instance => {
      metrics.inc('jobs/healthchecks.js:22');

      const container = await httpRequest({
        timeout: 3000,
        socketPath: config.dockerSocketPath,
        path: `/v1.26/containers/${instance.dockerId}/json`,
        validateStatus: () => true
      });

      if (container.response.statusCode !== 200) {
        notify.broadcast(instance.id);

        metrics.inc('jobs/healthchecks.js:34');
        const instanceTwo = await db.patch('instances', {
          status: 'failed',
          statusDetail: 'container disappeared',
          statusDate: Date.now()
        }, {
          query: {
            id: instance.id
          }
        });

        notify.broadcast(instance.id);

        return instanceTwo;
      }
    });

  return Promise.all(promises);
}

async function instanceHealthChecks ({ db, notify, metrics, settings, config }) {
  metrics.inc('jobs/healthchecks.js:55');
  const server = await db.getOne('servers', {
    query: {
      id: config.serverId
    }
  });

  const instances = await db.getAll('instances', {
    query: {
      serverId: config.serverId,
      status: {
        $in: ['starting', 'unhealthy', 'healthy']
      }
    },
    fields: ['dockerPort', 'status', 'statusDate', 'dateCreated']
  });

  const promises = instances.map(async instance => {
    try {
      if (!instance.dockerPort) {
        throw new Error('Instance does not have a dockerPort');
      }
      metrics.inc('jobs/healthchecks.js:77');
      const healthRequest = await httpRequest({
        url: `http://${server.hostname}:${instance.dockerPort}/health`,
        timeout: 3000
      });

      if (healthRequest.response.statusCode > 500) {
        throw new Error('health check returned ' + healthRequest.response.statusCode);
      }

      if (instance.status !== 'healthy') {
        metrics.inc('jobs/healthchecks.js:88');
        await db.patch('instances', {
          status: 'healthy',
          statusDetail: '',
          statusDate: Date.now()
        }, {
          query: {
            id: instance.id
          }
        });

        notify.broadcast(instance.id);

        return;
      }
    } catch (_) {
      if (instance.status === 'starting') {
        metrics.inc('jobs/healthchecks.js:105');
        const tooLongSinceStarted = instance.statusDate && Date.now() - instance.statusDate > MAX_START_TIME;
        if (tooLongSinceStarted) {
          await httpRequest({
            url: `https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}`,
            timeout: 3000,
            method: 'DELETE',
            headers: {
              host: settings.domains.api[0],
              'x-internal-secret': settings.secret
            }
          });

          await db.patch('instances', {
            status: 'failed',
            statusDetail: 'too long to start'
          }, {
            query: {
              id: instance.id
            }
          });

          notify.broadcast(instance.id);

          return;
        }

        return;
      }

      if (instance.status === 'unhealthy') {
        const tooLongSinceUnhealthy = instance.statusDate && Date.now() - instance.statusDate > MAX_UNHEALTHY_TIME;
        if (tooLongSinceUnhealthy) {
          metrics.inc('jobs/healthchecks.js:138');
          await httpRequest({
            url: `https://${server.hostname}:${server.apiPort}/internal/instances/${instance.id}`,
            timeout: 3000,
            method: 'DELETE',
            headers: {
              host: settings.domains.api[0],
              'x-internal-secret': settings.secret
            }
          });
          await db.patch('instances', {
            status: 'failed',
            statusDate: Date.now(),
            statusDetail: 'unhealthy too long'
          }, {
            query: {
              id: instance.id
            }
          });
        }

        return;
      }

      if (instance.status === 'healthy') {
        metrics.inc('jobs/healthchecks.js:163');
        await db.patch('instances', {
          status: 'unhealthy',
          statusDate: Date.now()
        }, {
          query: {
            id: instance.id
          }
        });

        notify.broadcast(instance.id);
      }
    }
  });

  return Promise.all(promises);
}

async function deploymentHealthChecks ({ db, notify, metrics, config }) {
  metrics.inc('jobs/healthchecks.js:182');
  const deployments = await db.getAll('deployments', {
    query: {
      guardianServerId: config.serverId,
      destroyed: false
    },
    fields: ['stable']
  });

  for (const deployment of deployments) {
    const instances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id,
        destroyed: false
      },
      fields: ['status']
    });

    const totalInstances = instances.filter(instance => !['destroyed', 'failed'].includes(instance.status)).length;
    const healthyInstances = instances.filter(instance => ['healthy'].includes(instance.status)).length;

    if (deployment.stable && totalInstances !== healthyInstances) {
      await db.patch('deployments', {
        stable: false
      }, {
        query: {
          id: deployment.id
        }
      });

      notify.broadcast(deployment.id);
      return;
    }

    if (!deployment.stable && totalInstances === healthyInstances && healthyInstances > 0) {
      await db.patch('deployments', {
        stable: true
      }, {
        query: {
          id: deployment.id
        }
      });

      notify.broadcast(deployment.id);
      return;
    }
  }
}

module.exports = function (scope) {
  hint('puzed.healthchecks', 'starting healthcheck batch');

  return Promise.all([
    instanceHealthChecks(scope),
    instanceDestroyChecks(scope),
    deploymentHealthChecks(scope)
  ]);
};
