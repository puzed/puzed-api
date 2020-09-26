const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const chalkCtx = new chalk.Instance({ level: 3 });
const axios = require('axios');
const execa = require('execa');
const tar = require('tar-fs');
const getPort = require('get-port');

const githubUsernameRegex = require('github-username-regex');

const { instanceLogListeners, instanceLogs } = require('./instanceLogger');

async function deployRepositoryToServer ({ db, notify, config }, instanceId) {
  const instance = await db.getOne('SELECT * FROM "instances" WHERE "id" = $1', [instanceId]);
  const project = await db.getOne('SELECT * FROM "projects" WHERE "id" = $1', [instance.projectId]);

  if (!githubUsernameRegex.test(project.owner)) {
    throw Object.assign(new Error('invalid github owner'), {
      statusCode: 422,
      body: {
        errors: {
          owner: ['not a valid owner according to validation policy']
        }
      }
    });
  }

  if (!githubUsernameRegex.test(project.repo)) {
    throw Object.assign(new Error('invalid github repo name'), {
      statusCode: 422,
      body: {
        errors: {
          repo: ['not a valid repo name according to validation policy']
        }
      }
    });
  }

  const secrets = JSON.parse(project.secrets);

  await db.run(`
    UPDATE "instances"
      SET "status" = 'building'
    WHERE "id" = $1
  `, [instanceId]);
  notify.broadcast(instanceId);

  const ignoreSshHostFileCheck = `GIT_SSH_COMMAND="ssh -i /tmp/${instanceId}.key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"`;

  const deployKey = await db.getOne(`
    SELECT * FROM "githubDeploymentKeys" WHERE "owner" = $1 AND "repo" = $2
  `, [project.owner, project.repo]);

  if (!deployKey) {
    throw new Error('no deploy key');
  }

  function log (...args) {
    const loggable = args.join(', ');
    (instanceLogListeners[instanceId] || []).forEach(output => output(loggable));
    instanceLogs[instanceId] = instanceLogs[instanceId] || '';
    instanceLogs[instanceId] = instanceLogs[instanceId] + loggable;
  }

  async function execCommand (command, options) {
    const loggable = '\n> ' + command
      .replace(ignoreSshHostFileCheck, '')
      .replace(deployKey.privateKey, '[hidden]')
      .trim() + '\n';

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
    log('\n' + chalkCtx.greenBright('Adding ssh key'));
    await execCommand(`
      echo "${deployKey.privateKey}" > /tmp/${instanceId}.key && chmod 600 /tmp/${instanceId}.key
    `);

    log('\n' + chalkCtx.greenBright('Cloning repo from github'));
    await execCommand(`
      ${ignoreSshHostFileCheck} git clone git@github.com:${project.owner}/${project.repo}.git /tmp/${instanceId}
    `);

    log('\n' + chalkCtx.greenBright('Checkout correct branch'));
    await execCommand(`${ignoreSshHostFileCheck} git checkout ${instance.commitHash}`, { cwd: `/tmp/${instanceId}` });

    log('\n' + chalkCtx.greenBright('Creating Dockerfile from template'));
    const dockerfileTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/Dockerfile.nodejs12'), 'utf8');
    const dockerfileContent = dockerfileTemplate
      .replace('{{buildCommand}}', project.buildCommand)
      .replace('{{runCommand}}', secrets.length > 0 ? 'sleep 10000000 || ' + project.runCommand : project.runCommand);
    await fs.writeFile(`/tmp/${instanceId}/Dockerfile`, dockerfileContent);

    log('\n' + chalkCtx.greenBright('Creating .dockerignore'));
    const dockerignoreTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/.dockerignore'), 'utf8');
    await fs.writeFile(`/tmp/${instanceId}/.dockerignore`, dockerignoreTemplate);

    log('\n' + chalkCtx.greenBright('Build docker image'));
    const imageTagName = `${project.name}:${instanceId}`;

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
        Env: project.environmentVariables ? project.environmentVariables.split('\n') : undefined,
        Image: imageTagName,
        ExposedPorts: {
          [`${project.webPort}/tcp`]: {}
        },
        HostConfig: {
          PortBindings: {
            [`${project.webPort}/tcp`]: [{
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
    await execCommand(`rm -rf /tmp/${instanceId}.key`, { cwd: '/tmp' });

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
      await execCommand(`rm -rf /tmp/${instanceId}.key`, { cwd: '/tmp' });
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
