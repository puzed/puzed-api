const axios = require('axios');
const hint = require('hinton');
const MAX_START_TIME = 10 * 1000;

async function instanceDestroyChecks ({ db, notify, config }) {
  const instances = await db.getAll('instances', {
    query: {
      serverId: config.serverId,
      dockerId: {
        $null: false
      },
      status: {
        $ne: ['queued', 'destroyed', 'healthy']
      }
    },
    fields: []
  });

  const promises = instances.map(async instance => {
    const container = await axios({
      socketPath: config.dockerSocketPath,
      url: `/v1.26/containers/${instance.dockerId}/json`,
      validateStatus: () => true
    });

    if (container.status !== 200) {
      notify.broadcast(instance.id);

      return db.patch('instances', {
        status: 'destroyed',
        statusDate: Date.now()
      }, {
        query: {
          id: instance.id
        }
      });
    }
  });

  return Promise.all(promises);
}

async function instanceHealthChecks ({ db, notify, config }) {
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
    fields: ['dockerPort', 'status', 'statusDate']
  });

  const promises = instances.map(async instance => {
    try {
      await axios(`http://${server.hostname}:${instance.dockerPort}/health`, {
        validateStatus: () => true
      });

      if (instance.status !== 'healthy') {
        notify.broadcast(instance.id);

        return db.patch('instances', {
          status: 'healthy',
          statusDate: Date.now()
        }, {
          query: {
            id: instance.id
          }
        });
      }
    } catch (_) {
      if (instance.status === 'starting') {
        if (!instance.statusDate || Date.now() - instance.statusDate > MAX_START_TIME) {
          await db.patch('instances', {
            status: 'failed'
          }, {
            query: {
              id: instance.id
            }
          });

          return;
        }

        return;
      }

      if (instance.status === 'healthy') {
        notify.broadcast(instance.id);
        return db.patch('instances', {
          status: 'unhealthy',
          statusDate: Date.now()
        }, {
          query: {
            id: instance.id
          }
        });
      }
    }
  });

  return Promise.all(promises);
}

async function deploymentHealthChecks ({ db, notify, config }) {
  const deployments = await db.getAll('deployments', {
    query: {
      guardianServerId: config.serverId,
      destroyed: {
        $ne: true
      }
    },
    fields: ['stable']
  });

  for (const deployment of deployments) {
    const instances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id,
        destroyed: {
          $ne: true
        }
      },
      fields: ['status']
    });
    const totalInstances = instances.length;
    const healthyInstances = instances.filter(instance => ['healthy', 'destroyed'].includes(instance.status)).length;

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

module.exports = function ({ db, notify, config }) {
  hint('puzed.healthchecks', 'starting healthcheck batch');

  return Promise.all([
    instanceHealthChecks({ db, notify, config }),
    instanceDestroyChecks({ db, notify, config }),
    deploymentHealthChecks({ db, notify, config })
  ]);
};
