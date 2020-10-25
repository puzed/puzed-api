const hint = require('hinton');

async function performAutoSwitches ({ db, notify, config }) {
  hint('puzed.autoSwitches', 'starting autoswitches batch');

  const deployments = await db.getAll('deployments', {
    query: {
      guardianServerId: config.serverId,
      autoSwitch: { $null: false }
    }
  });

  for (const deployment of deployments) {
    if (deployment.stable) {
      const targetDeployment = await db.getOne('deployments', {
        query: {
          serviceId: deployment.serviceId,
          title: deployment.autoSwitch.targetDeployment
        }
      });

      await db.patch('deployments', {
        title: deployment.autoSwitch.newTitle
      }, { query: { id: targetDeployment.id } });

      await db.patch('deployments', {
        title: deployment.autoSwitch.targetDeployment,
        autoSwitch: null
      }, { query: { id: deployment.id } });

      notify.broadcast(deployment.id);
      notify.broadcast(targetDeployment.id);
      return;
    }
  }
}

module.exports = performAutoSwitches;
