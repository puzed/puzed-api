const axios = require('axios');
const getPort = require('get-port');

const executeCommandInContainer = require('./dockerCommands/executeCommandInContainer');
const getInstanceAndRelated = require('../queries/instances/getInstanceAndRelated');

async function deployRepositoryToServer (scope, instanceId) {
  const { db, notify, config } = scope;

  const {
    deployment
  } = await getInstanceAndRelated(scope, instanceId);

  const secrets = JSON.parse(deployment.service.secrets);

  async function updateStatusAndDetail (status, statusDetail) {
    await db.patch('instances', {
      status: status,
      statusDetail: statusDetail
    }, {
      query: {
        id: instanceId
      }
    });
    notify.broadcast(instanceId);
  }

  await updateStatusAndDetail('starting', 'finding image');

  try {
    const imageTagName = deployment.imageId;

    const existingImage = await axios({
      socketPath: config.dockerSocketPath,
      url: `/v1.40/images/${imageTagName}/json`,
      validateStatus: () => true
    });

    if (existingImage.data.length === 0) {
      throw new Error('NOT IMPLEMENTED: Pull image from guardian server');
      // await updateStatusAndDetail('starting', 'pulling image');
    }

    await updateStatusAndDetail('starting', 'creating container');
    const containerCreationResult = await axios({
      method: 'post',
      socketPath: config.dockerSocketPath,
      url: '/v1.40/containers/create',
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({
        Env: deployment.service.environmentVariables ? deployment.service.environmentVariables.split('\n') : undefined,
        Image: imageTagName,
        ExposedPorts: {
          [`${deployment.service.webPort}/tcp`]: {}
        },
        Labels: {
          serviceName: deployment.service.name,
          deploymentTitle: deployment.title,
          commitHash: deployment.commitHash
        },
        HostConfig: {
          Memory: (deployment.service.memory || 500) * 1000000,
          MemorySwap: (deployment.service.memory || 500) * 1000000,
          MemorySwappiness: 0,
          PortBindings: {
            [`${deployment.service.webPort}/tcp`]: [{
              HostPort: (await getPort()).toString()
            }]
          },
          PublishAllPorts: true,
          Runtime: config.dockerRuntime || 'runc'
        }
      })
    });

    const dockerId = containerCreationResult.data.Id;

    await axios({
      method: 'post',
      socketPath: config.dockerSocketPath,
      url: `/v1.26/containers/${dockerId}/start`
    });

    if (secrets.length > 0) {
      await updateStatusAndDetail('starting', 'creating secrets');
      const secretsWriteScript = secrets.map(secret => {
        if (!secret || !secret.data) {
          console.log(new Error(`Secret ${secret.name} was missing`));
          return '';
        }
        const data = secret.data.split(',').slice(-1);
        return `(echo "${data}" | base64 -d > ${secret.name})`;
      }).join(' && ');

      await executeCommandInContainer(scope, dockerId, `mkdir -p /run/secrets && ${secretsWriteScript}`);
    }

    await updateStatusAndDetail('starting', 'starting service');
    await executeCommandInContainer(scope, dockerId, 'pkill sleep');

    await updateStatusAndDetail('starting', 'discovering port');
    const dockerContainer = await axios({
      socketPath: config.dockerSocketPath,
      url: `/v1.26/containers/${dockerId}/json`
    });

    const dockerPort = Object.values(dockerContainer.data.NetworkSettings.Ports)[0][0].HostPort;

    await db.patch('instances', {
      dockerId,
      dockerPort,
      statusDetail: 'waiting health',
      statusDate: Date.now()
    }, {
      query: {
        id: instanceId
      }
    });

    notify.broadcast(instanceId);
  } catch (error) {
    console.log(error);

    await db.patch('instances', {
      status: 'failed',
      statusDetail: ''
    }, {
      query: {
        id: instanceId
      }
    });

    notify.broadcast(instanceId);
  }
}

module.exports = deployRepositoryToServer;
