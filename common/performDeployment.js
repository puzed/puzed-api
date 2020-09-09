const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
chalk.level = 3;
const axios = require('axios');
const postgres = require('postgres-fp/promises');
const execa = require('execa');

const githubUsernameRegex = require('github-username-regex');

const { deploymentLogListeners, deploymentLogs } = require('./deploymentLogger');

async function deployRepositoryToServer ({ db, notify, config }, deploymentId) {
  const deployment = await postgres.getOne(db, 'SELECT * FROM "deployments" WHERE "id" = $1', [deploymentId]);
  const project = await postgres.getOne(db, 'SELECT * FROM "projects" WHERE "id" = $1', [deployment.projectId]);

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

  await postgres.run(db, `
    UPDATE "deployments"
      SET "status" = 'building'
    WHERE "id" = $1
  `, [deploymentId]);
  notify.broadcast(deploymentId);

  const ignoreSshHostFileCheck = `GIT_SSH_COMMAND="ssh -i /tmp/${deploymentId}.key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"`;

  const deployKey = await postgres.getOne(db, `
    SELECT * FROM "githubDeploymentKeys" WHERE "owner" = $1 AND "repo" = $2
  `, [project.owner, project.repo]);

  if (!deployKey) {
    throw new Error('no deploy key');
  }

  function log (...args) {
    const loggable = args.join(', ');
    (deploymentLogListeners[deploymentId] || []).forEach(output => output(loggable));
    deploymentLogs[deploymentId] = deploymentLogs[deploymentId] || '';
    deploymentLogs[deploymentId] = deploymentLogs[deploymentId] + loggable;
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
      throw Object.assign(new Error('deployment failed'), {
        cmd: command,
        ...result
      });
    }

    return result;
  }

  try {
    log('\n' + chalk.greenBright('Adding ssh key'));
    await execCommand(`
      echo "${deployKey.privateKey}" > /tmp/${deploymentId}.key && chmod 600 /tmp/${deploymentId}.key
    `);

    log('\n' + chalk.greenBright('Cloning repo from github'));
    await execCommand(`
      ${ignoreSshHostFileCheck} git clone git@github.com:${project.owner}/${project.repo}.git /tmp/${deploymentId}
    `);

    log('\n' + chalk.greenBright('Checkout correct branch'));
    await execCommand(`${ignoreSshHostFileCheck} git checkout ${deployment.commitHash}`, { cwd: `/tmp/${deploymentId}` });

    log('\n' + chalk.greenBright('Creating Dockerfile from template'));
    const dockerfileTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/Dockerfile.nodejs12'), 'utf8');
    const dockerfileContent = dockerfileTemplate
      .replace('{{buildCommand}}', project.buildCommand)
      .replace('{{runCommand}}', secrets.length > 0 ? 'sleep 10000000 || ' + project.runCommand : project.runCommand);
    await fs.writeFile(`/tmp/${deploymentId}/Dockerfile`, dockerfileContent);

    log('\n' + chalk.greenBright('Creating .dockerignore'));
    const dockerignoreTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/.dockerignore'), 'utf8');
    await fs.writeFile(`/tmp/${deploymentId}/.dockerignore`, dockerignoreTemplate);

    log('\n' + chalk.greenBright('Build docker image'));
    const imageTagName = `${project.name}:${deploymentId}`;
    await execCommand(
      `docker build -t ${imageTagName} .`, { cwd: `/tmp/${deploymentId}` }
    );

    await postgres.run(db, `
      UPDATE "deployments"
      SET "status" = 'starting'
      WHERE "id" = $1
    `, [deploymentId]);
    notify.broadcast(deploymentId);

    log('\n' + chalk.greenBright('Creating container'));
    const containerCreationResult = await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: '/v1.26/containers/create',
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
          PublishAllPorts: true,
          Runtime: config.dockerRuntime || 'runc'
        }
      })
    });
    const dockerId = containerCreationResult.data.Id;

    log('\n' + chalk.greenBright('Starting container'));
    await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${dockerId}/start`
    });
    log('\nstarted');

    if (secrets.length > 0) {
      log('\n' + chalk.greenBright('Creating secrets'));
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
      const secretsStartResponse = await axios({
        method: 'post',
        socketPath: '/var/run/docker.sock',
        url: `/v1.26/exec/${secretsCreateResponse.data.Id}/start`,
        headers: {
          'content-type': 'application/json'
        },
        data: JSON.stringify({

        })
      });
      console.log(secretsStartResponse.data);
    }

    log('\n' + chalk.greenBright('Discovering allocated port'));
    const dockerPortResult = await execCommand(`docker port ${dockerId}`);
    const dockerPort = dockerPortResult.stdout.split(':')[1];

    log('\n' + chalk.greenBright('Cleaning up build directory'));
    await execCommand(`rm -rf /tmp/${deploymentId}`, { cwd: '/tmp' });
    await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/tmp' });

    log('\n' + chalk.cyanBright('🟢 Your website is now live'));
    (deploymentLogListeners[deploymentId] || []).forEach(output => output(null));
    await postgres.run(db, `
      UPDATE "deployments"
      SET "buildLog" = $2,
          "dockerId" = $3,
          "dockerPort" = $4
      WHERE "id" = $1
    `, [deploymentId, deploymentLogs[deploymentId].trim(), dockerId, dockerPort]);
    notify.broadcast(deploymentId);
  } catch (error) {
    console.log(error);
    log('\n' + chalk.redBright(error.message));
    log('\n' + chalk.greenBright('Cleaning up build directory'));
    (deploymentLogListeners[deploymentId] || []).forEach(output => output(null));
    try {
      await execCommand(`rm -rf /tmp/${deploymentId}`, { cwd: '/tmp' });
      await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/tmp' });
    } catch (error) {
      console.log(error);
    }

    await postgres.run(db, `
      UPDATE "deployments"
      SET "buildLog" = $2,
          "status" = 'failed'
      WHERE "id" = $1
    `, [deploymentId, deploymentLogs[deploymentId].trim()]);
    notify.broadcast(deploymentId);
  }
}

module.exports = deployRepositoryToServer;
