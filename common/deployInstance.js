const path = require('path');
const http = require('http');
const fs = require('fs').promises;
const chalk = require('chalk');
const chalkCtx = new chalk.Instance({ level: 3 });
const axios = require('axios');
const execa = require('execa');
const tar = require('tar-fs');
const getPort = require('get-port');
const ndJsonFe = require('ndjson-fe');

const { instanceLogListeners, instanceLogs } = require('./instanceLogger');

async function extractTarIntoContainer ({ config }, containerId, tarPath, destination) {
  const executeResponse = await axios({
    method: 'put',
    socketPath: config.dockerSocketPath,
    url: `/v1.40/containers/${containerId}/archive?path=${destination}`,
    headers: {
      'content-type': 'application/x-tar'
    },
    data: require('fs').createReadStream(tarPath)
  });

  return executeResponse;
}

async function executeCommandInContainer ({ config }, containerId, command) {
  const executeResponse = await axios({
    method: 'post',
    socketPath: config.dockerSocketPath,
    url: `/v1.26/containers/${containerId}/exec`,
    headers: {
      'content-type': 'application/json'
    },
    data: JSON.stringify({
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['sh', '-c', command]
    })
  });

  const startResponse = await axios({
    method: 'post',
    socketPath: config.dockerSocketPath,
    url: `/v1.26/exec/${executeResponse.data.Id}/start`,
    headers: {
      'content-type': 'application/json'
    },
    data: JSON.stringify({
    })
  });

  return startResponse;
}

async function createTextFileInContainer (scope, containerId, destinationPath, content) {
  const data = Buffer.from(content).toString('base64');
  const command = `(echo "${data}" | base64 -d > ${destinationPath})`;

  return executeCommandInContainer(scope, containerId, command);
}

// async function insertFileIntoContainer (containerId, sourcePath, destinationPath) {
//   const data = await fs.readFile(sourcePath, 'base64');
//   const command = `(echo "${data}" | base64 -d > ${destinationPath})`;

//   return executeCommandInContainer(containerId, command);
// }

async function deployRepositoryToServer (scope, instanceId) {
  const { db, notify, providers, config } = scope;

  const server = await scope.db.getOne('servers', {
    query: {
      id: scope.config.serverId
    }
  });

  const instance = await scope.db.getOne('instances', {
    query: {
      id: instanceId
    }
  });

  const deployment = await scope.db.getOne('deployments', {
    query: {
      id: instance.deploymentId
    }
  });

  const service = await scope.db.getOne('services', {
    query: {
      id: instance.serviceId
    }
  });

  const link = await scope.db.getOne('links', {
    query: {
      id: service.linkId
    }
  });

  const provider = providers[link.providerId];

  const secrets = JSON.parse(service.secrets);

  await db.patch('instances', {
    status: 'building'
  }, {
    query: {
      id: instanceId
    }
  });

  notify.broadcast(instanceId);

  function log (...args) {
    const loggable = args.join(', ');
    (instanceLogListeners[instanceId] || []).forEach(output => output(loggable));
    instanceLogs[instanceId] = instanceLogs[instanceId] || '';
    instanceLogs[instanceId] = instanceLogs[instanceId] + loggable;
  }

  function buildImage (imageTagName, data) {
    return new Promise((resolve, reject) => {
      const feed = ndJsonFe();

      const buildImageRequest = http.request({
        method: 'post',
        socketPath: config.dockerSocketPath,
        path: `/v1.26/build?t=${imageTagName}`,
        headers: {
          'content-type': 'application/x-tar'
        }
      }, function (response) {
        response.on('error', reject);
        response.on('end', resolve);
        feed.on('next', row => {
          log(row.stream);
          if (row.error) {
            log(row.error);
          }
        });
        response.pipe(feed);
      });
      data.pipe(buildImageRequest);
    });
  }

  async function execCommand (command, options) {
    const loggable = '\n> ' + command.trim() + '\n';

    log(loggable);

    const subprocess = execa('sh', ['-c', command], options);
    subprocess.stdout.on('data', data => log(data.toString()));
    subprocess.stderr.on('data', data => log(data.toString()));
    const result = await subprocess;

    if (result.exitCode) {
      throw Object.assign(new Error('instance failed'), {
        cmd: command,
        ...result
      });
    }

    return result;
  }

  async function generateDockerfile (templateName, options) {
    let template = await fs.readFile(path.resolve(__dirname, `../dockerfileTemplates/Dockerfile.${templateName}`), 'utf8');

    template = template
      .replace('{{buildCommand}}', options.buildCommand)
      .replace('{{runCommand}}', options.runCommand);

    template = template.replace(/^RUN (.*)$/gm, (a, b) => {
      return `RUN proxychains -q sh -c "${b.replace(/"/g, '\\"')}"`;
    });

    template = template.replace('{{setupNetwork}}', [
      templateName.startsWith('linux.') ? 'COPY  ./__puzedVendor__/proxychains4/runtime.tar /tmp/runtime.tar' : '',
      templateName.startsWith('linux.') ? 'RUN cd /tmp && tar xvf runtime.tar' : '',

      templateName.startsWith('linux.') ? 'RUN mv /tmp/proxychains /usr/local/bin/proxychains' : '',
      templateName.startsWith('linux.') ? 'RUN mv /tmp/libproxychains4.so /usr/local/lib/libproxychains4.so' : '',

      templateName.startsWith('alpine.') ? 'RUN apk add proxychains-ng' : '',

      'COPY  ./__puzedVendor__/proxychains4/proxychains.conf /opt/proxychains4/proxychains.conf',
      'ENV PROXYCHAINS_CONF_FILE=/opt/proxychains4/proxychains.conf',
      `RUN echo "socks5 ${options.socksHost} ${options.socksPort} ${options.socksUser} ${options.socksPass}" >> /opt/proxychains4/proxychains.conf`
    ].join('\n'));

    return template;
  }

  try {
    const imageTagName = `${deployment.id}:${instance.commitHash}`;

    log('\n' + chalkCtx.greenBright('Searching for existing image'));
    const existingImage = await axios({
      socketPath: config.dockerSocketPath,
      url: `/v1.40/images/json?filter=${imageTagName}`,
      validateStatus: () => true
    });

    if (existingImage.data.length > 0) {
      log('\n' + chalkCtx.greenBright('Using existing image'));
    } else {
      log('\n' + chalkCtx.greenBright('Cloning repo from github'));
      await provider.cloneRepository(scope, {
        service,
        instance,
        providerRepositoryId: service.providerRepositoryId,
        branch: instance.commitHash,
        target: `/tmp/${instanceId}`
      });

      log('\n' + chalkCtx.greenBright('Creating Dockerfile from template'));
      const runCommand = `sleep 60 || proxychains sh -c "${service.runCommand}"`;

      const dockerfileContent = await generateDockerfile(service.image, {
        socksHost: server.hostname,
        socksPort: '1080',
        socksUser: service.id,
        socksPass: service.networkAccessToken,

        buildCommand: service.buildCommand,
        runCommand
      });

      await fs.writeFile(`/tmp/${instanceId}/Dockerfile`, dockerfileContent);

      log('\n' + chalkCtx.greenBright('Creating .dockerignore'));
      const dockerignoreTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/.dockerignore'), 'utf8');
      await fs.writeFile(`/tmp/${instanceId}/.dockerignore`, dockerignoreTemplate);

      log('\n' + chalkCtx.greenBright('Build docker image\n'));
      await fs.mkdir(`/tmp/${instanceId}/__puzedVendor__/proxychains4/`, { recursive: true });
      await Promise.all([
        fs.copyFile(path.resolve(__dirname, '../vendor/proxychains4/runtime.tar'), `/tmp/${instanceId}/__puzedVendor__/proxychains4/runtime.tar`),
        fs.copyFile(path.resolve(__dirname, '../vendor/proxychains4/proxychains.conf'), `/tmp/${instanceId}/__puzedVendor__/proxychains4/proxychains.conf`)
      ]);

      await buildImage(imageTagName, tar.pack(`/tmp/${instanceId}`));
    }

    await db.patch('instances', {
      status: 'starting'
    }, {
      query: {
        id: instanceId
      }
    });

    notify.broadcast(instanceId);

    log('\n' + chalkCtx.greenBright('Creating container'));

    const containerCreationResult = await axios({
      method: 'post',
      socketPath: config.dockerSocketPath,
      url: '/v1.40/containers/create',
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({
        Env: service.environmentVariables ? service.environmentVariables.split('\n') : undefined,
        Image: imageTagName,
        ExposedPorts: {
          [`${service.webPort}/tcp`]: {}
        },
        HostConfig: {
          Memory: (service.memory || 500) * 1000000,
          MemorySwap: (service.memory || 500) * 1000000,
          MemorySwappiness: 0,
          PortBindings: {
            [`${service.webPort}/tcp`]: [{
              HostPort: (await getPort()).toString()
            }]
          },
          PublishAllPorts: true,
          Runtime: config.dockerRuntime || 'runc'
        }
      })
    });

    const dockerId = containerCreationResult.data.Id;

    log('\n' + chalkCtx.greenBright('Starting container'));
    await axios({
      method: 'post',
      socketPath: config.dockerSocketPath,
      url: `/v1.26/containers/${dockerId}/start`
    });

    log('\n' + chalkCtx.greenBright('Applying networking layer'));
    await executeCommandInContainer(scope, dockerId, 'mkdir -p /opt/proxychains');
    const proxychains = (await fs.readFile('./vendor/proxychains4/proxychains.conf', 'utf8')) +
      `socks5 ${server.hostname} 1080 ${service.id} ${service.networkAccessToken}`;

    await createTextFileInContainer(scope, dockerId, '/opt/proxychains/proxychains.conf', proxychains);
    await extractTarIntoContainer(scope, dockerId, './vendor/proxychains4/runtime.tar', '/opt/proxychains');

    if (secrets.length > 0) {
      log('\n' + chalkCtx.greenBright('Creating secrets'));
      const secretsWriteScript = secrets.map(secret => {
        if (!secret || !secret.data) {
          log('\n' + chalkCtx.redBright('Secret was missing' + JSON.stringify(secret)));
          return '';
        }
        const data = secret.data.split(',').slice(-1);
        return `(echo "${data}" | base64 -d > ${secret.name})`;
      }).join(' && ');

      await executeCommandInContainer(scope, dockerId, `mkdir -p /run/secrets && ${secretsWriteScript}`);
    }

    await executeCommandInContainer(scope, dockerId, 'pkill sleep');

    log('\n' + chalkCtx.greenBright('Discovering allocated port'));
    const dockerContainer = await axios({
      socketPath: config.dockerSocketPath,
      url: `/v1.26/containers/${dockerId}/json`
    });

    const dockerPort = Object.values(dockerContainer.data.NetworkSettings.Ports)[0][0].HostPort;

    log('\n' + chalkCtx.greenBright('Cleaning up build directory'));
    await execCommand(`rm -rf /tmp/${instanceId}`, { cwd: '/tmp' });

    log('\n' + chalkCtx.cyanBright('🟢 Your website is now live'));
    (instanceLogListeners[instanceId] || []).forEach(output => output(null));

    await db.patch('instances', {
      buildLog: instanceLogs[instanceId].trim(),
      dockerId,
      dockerPort,
      statusDate: Date.now()
    }, {
      query: {
        id: instanceId
      }
    });

    notify.broadcast(instanceId);
  } catch (error) {
    console.log(error);
    log('\n' + chalkCtx.redBright(error.message));
    log('\n' + chalkCtx.greenBright('Cleaning up build directory'));
    (instanceLogListeners[instanceId] || []).forEach(output => output(null));
    try {
      await execCommand(`rm -rf /tmp/${instanceId}`, { cwd: '/tmp' });
    } catch (error) {
      console.log(error);
    }

    await db.patch('instances', {
      buildLog: instanceLogs[instanceId].trim(),
      status: 'failed'
    }, {
      query: {
        id: instanceId
      }
    });

    notify.broadcast(instanceId);
  }
}

module.exports = deployRepositoryToServer;
