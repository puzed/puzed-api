const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const chalkCtx = new chalk.Instance({ level: 3 });
const axios = require('axios');
const execa = require('execa');
const tar = require('tar-fs');
const getPort = require('get-port');

const { instanceLogListeners, instanceLogs } = require('./instanceLogger');

async function deployRepositoryToServer (scope, instanceId) {
  const { db, notify, providers, config } = scope;

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
    const dockerfileTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/Dockerfile.nodejs12'), 'utf8');
    const dockerfileContent = dockerfileTemplate
      .replace('{{buildCommand}}', service.buildCommand)
      .replace('{{runCommand}}', secrets.length > 0 ? 'sleep 10000000 || ' + service.runCommand : service.runCommand);
    await fs.writeFile(`/tmp/${instanceId}/Dockerfile`, dockerfileContent);

    log('\n' + chalkCtx.greenBright('Creating .dockerignore'));
    const dockerignoreTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/.dockerignore'), 'utf8');
    await fs.writeFile(`/tmp/${instanceId}/.dockerignore`, dockerignoreTemplate);

    log('\n' + chalkCtx.greenBright('Build docker image'));
    const imageTagName = `${service.name}:${instanceId}`;

    const buildImageResponse = await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/build?t=${imageTagName}`,
      headers: {
        'content-type': 'application/x-tar'
      },
      data: tar.pack(`/tmp/${instanceId}`)
    });

    log('\n' + buildImageResponse.data);

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
    log('\nstarted');

    if (secrets.length > 0) {
      log('\n' + chalkCtx.greenBright('Creating secrets'));
      const secretsWriteScript = secrets.map(secret => {
        const data = secret.data.split(',').slice(-1);
        return `(echo "${data}" | base64 -d > ${secret.name})`;
      }).join(' && ');

      const secretsCreateResponse = await axios({
        method: 'post',
        socketPath: '/var/run/docker.sock',
        url: `/v1.26/containers/${dockerId}/exec`,
        headers: {
          'content-type': 'application/json'
        },
        data: JSON.stringify({
          AttachStdin: false,
          AttachStdout: true,
          AttachStderr: true,
          Cmd: ['sh', '-c', `mkdir -p /run/secrets && ${secretsWriteScript} && pkill sleep`]
        })
      });
      await axios({
        method: 'post',
        socketPath: '/var/run/docker.sock',
        url: `/v1.26/exec/${secretsCreateResponse.data.Id}/start`,
        headers: {
          'content-type': 'application/json'
        },
        data: JSON.stringify({

        })
      });
    }

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
