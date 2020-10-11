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

async function extractTarIntoContainer (containerId, tarPath, destination) {
  const executeResponse = await axios({
    method: 'put',
    socketPath: '/var/run/docker.sock',
    url: `/v1.40/containers/${containerId}/archive?path=${destination}`,
    headers: {
      'content-type': 'application/x-tar'
    },
    data: require('fs').createReadStream(tarPath)
  });

  return executeResponse;
}

async function executeCommandInContainer (containerId, command) {
  const executeResponse = await axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
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
    socketPath: '/var/run/docker.sock',
    url: `/v1.26/exec/${executeResponse.data.Id}/start`,
    headers: {
      'content-type': 'application/json'
    },
    data: JSON.stringify({
    })
  });

  return startResponse;
}

async function createTextFileInContainer (containerId, destinationPath, content) {
  const data = Buffer.from(content).toString('base64');
  const command = `(echo "${data}" | base64 -d > ${destinationPath})`;

  return executeCommandInContainer(containerId, command);
}

// async function insertFileIntoContainer (containerId, sourcePath, destinationPath) {
//   const data = await fs.readFile(sourcePath, 'base64');
//   const command = `(echo "${data}" | base64 -d > ${destinationPath})`;

//   return executeCommandInContainer(containerId, command);
// }

async function deployRepositoryToServer (scope, instanceId) {
  const { db, notify, providers, config } = scope;

  const server = await scope.db.getOne('SELECT * FROM "servers" WHERE "id" = $1', [scope.config.serverId]);

  const instance = await db.getOne('SELECT * FROM "instances" WHERE "id" = $1', [instanceId]);
  const service = await db.getOne(`
    SELECT "services".*, "providerId"
      FROM "services"
 LEFT JOIN "links" ON "links"."id" = "services"."linkId"
     WHERE "services"."id" = $1
  `, [instance.serviceId]);

  const provider = providers[service.providerId];

  const secrets = JSON.parse(service.secrets);

  await db.run(`
    UPDATE "instances"
      SET "status" = 'building'
    WHERE "id" = $1
  `, [instanceId]);
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
        socketPath: '/var/run/docker.sock',
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
      return `RUN /opt/proxychains4/proxychains4 -f /opt/proxychains4/proxychains.conf -q sh -c "${b.replace(/"/g, '\\"')}"`;
    });

    template = template.replace('{{setupNetwork}}', [
      'COPY ./__puzedVendor__/proxychains4 /opt/proxychains4',
      'RUN cd /opt/proxychains4 && tar xvf runtime.tar',
      `RUN echo "socks5 ${options.socksHost} ${options.socksPort} ${options.socksUser} ${options.socksPass}" >> /opt/proxychains4/proxychains.conf`
    ].join('\n'));

    return template;
  }

  try {
    log('\n' + chalkCtx.greenBright('Cloning repo from github'));
    await provider.cloneRepository(scope, {
      service,
      instance,
      providerRepositoryId: service.providerRepositoryId,
      branch: instance.commitHash,
      target: `/tmp/${instanceId}`
    });

    log('\n' + chalkCtx.greenBright('Creating Dockerfile from template'));
    const runCommand = `sleep 60 || /opt/proxychains/proxychains4 -f /opt/proxychains/proxychains.conf bash -c "${service.runCommand}"`;

    const dockerfileContent = await generateDockerfile('nodejs12', {
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
    const imageTagName = `${service.id}:${instanceId}`;

    await fs.mkdir(`/tmp/${instanceId}/__puzedVendor__/proxychains4/`, { recursive: true });
    await Promise.all([
      fs.copyFile(path.resolve(__dirname, '../vendor/proxychains4/runtime.tar'), `/tmp/${instanceId}/__puzedVendor__/proxychains4/runtime.tar`),
      fs.copyFile(path.resolve(__dirname, '../vendor/proxychains4/proxychains.conf'), `/tmp/${instanceId}/__puzedVendor__/proxychains4/proxychains.conf`)
    ]);

    await buildImage(imageTagName, tar.pack(`/tmp/${instanceId}`));

    await db.run(`
      UPDATE "instances"
      SET "status" = 'starting'
      WHERE "id" = $1
    `, [instanceId]);
    notify.broadcast(instanceId);

    log('\n' + chalkCtx.greenBright('Creating container'));

    const containerCreationResult = await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: '/v1.24/containers/create',
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
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${dockerId}/start`
    });

    log('\n' + chalkCtx.greenBright('Applying networking layer'));
    await executeCommandInContainer(dockerId, 'mkdir -p /opt/proxychains');
    const proxychains = (await fs.readFile('./vendor/proxychains4/proxychains.conf', 'utf8')) +
      `socks5 ${server.hostname} 1080 ${service.id} ${service.networkAccessToken}`;

    await createTextFileInContainer(dockerId, '/opt/proxychains/proxychains.conf', proxychains);
    await extractTarIntoContainer(dockerId, './vendor/proxychains4/runtime.tar', '/opt/proxychains');

    if (secrets.length > 0) {
      log('\n' + chalkCtx.greenBright('Creating secrets'));
      const secretsWriteScript = secrets.map(secret => {
        const data = secret.data.split(',').slice(-1);
        return `(echo "${data}" | base64 -d > ${secret.name})`;
      }).join(' && ');

      await executeCommandInContainer(dockerId, `mkdir -p /run/secrets && ${secretsWriteScript}`);
    }

    await executeCommandInContainer(dockerId, 'pkill sleep');

    log('\n' + chalkCtx.greenBright('Discovering allocated port'));
    const dockerContainer = await axios({
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${dockerId}/json`
    });

    const dockerPort = Object.values(dockerContainer.data.NetworkSettings.Ports)[0][0].HostPort;

    log('\n' + chalkCtx.greenBright('Cleaning up build directory'));
    await execCommand(`rm -rf /tmp/${instanceId}`, { cwd: '/tmp' });

    log('\n' + chalkCtx.cyanBright('🟢 Your website is now live'));
    (instanceLogListeners[instanceId] || []).forEach(output => output(null));
    await db.run(`
      UPDATE "instances"
      SET "buildLog" = $2,
          "dockerId" = $3,
          "dockerPort" = $4
      WHERE "id" = $1
    `, [instanceId, instanceLogs[instanceId].trim(), dockerId, dockerPort]);
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

    await db.run(`
      UPDATE "instances"
      SET "buildLog" = $2,
          "status" = 'failed'
      WHERE "id" = $1
    `, [instanceId, instanceLogs[instanceId].trim()]);
    notify.broadcast(instanceId);
  }
}

module.exports = deployRepositoryToServer;
