const axios = require('axios');
const hint = require('hinton');

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
    fields: ['dockerPort', 'status']
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

  await Promise.all(promises);
}

async function deploymentHealthChecks ({ db, notify, config }) {
  const deployments = await db.getAll('deployments', {
    query: {
      guardianServerId: config.serverId
    },
    fields: ['stable']
  });

  for (const deployment of deployments) {
    const instances = await db.getAll('instances', {
      query: {
        deploymentId: deployment.id,
        status: {
          $nin: ['destroyed']
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

module.exports = async function ({ db, notify, config }) {
  hint('puzed.healthchecks', 'starting healthcheck batch');
  instanceHealthChecks({ db, notify, config });
  deploymentHealthChecks({ db, notify, config });
};
