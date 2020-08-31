const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
chalk.level = 3;
const axios = require('axios');
const postgres = require('postgres-fp/promises');
const uuidv4 = require('uuid').v4;
const NodeSSH = require('node-ssh').NodeSSH;
const githubUsernameRegex = require('github-username-regex');
const dockerSshHttpAgent = require('docker-ssh-http-agent');

const selectRandomItemFromArray = require('../common/selectRandomItemFromArray');

async function deployRepositoryToServer ({ db, config }, project, options = {}) {
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

  const deploymentId = uuidv4();
  await postgres.insert(db, 'deployments', {
    id: deploymentId,
    projectId: project.id,
    status: 'pending',
    datecreated: Date.now()
  });

  const dockerHost = selectRandomItemFromArray(config.dockerHosts);
  const dockerAgent = dockerSshHttpAgent({
    host: dockerHost,
    port: 22,
    username: config.sshUsername,
    privateKey: config.sshPrivateKey
  });

  const ignoreSshHostFileCheck = `GIT_SSH_COMMAND="ssh -i /tmp/${deploymentId}.key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"`;

  let buildLog = '';

  const deployKey = await postgres.getOne(db, `
    SELECT * FROM github_deployment_keys WHERE owner = $1 AND repo = $2
  `, [project.owner, project.repo]);

  if (!deployKey) {
    throw new Error('no deploy key');
  }

  const output = {
    onStdout (chunk) {
      options.onOutput && options.onOutput(deploymentId, chunk.toString('ascii'));
      buildLog = buildLog + chunk.toString('ascii');
    },

    onStderr (chunk) {
      options.onOutput && options.onOutput(deploymentId, chunk.toString('ascii'));
      buildLog = buildLog + chunk.toString('ascii');
    }
  };

  function log (...args) {
    const loggable = args.join(', ');
    options.onOutput && options.onOutput(deploymentId, '\n' + loggable);

    buildLog = buildLog + '\n' + loggable;
  }

  async function execCommand (...args) {
    const loggable = '\n> ' + args[0]
      .replace(ignoreSshHostFileCheck, '')
      .replace(deployKey.privatekey, '[hidden]')
      .trim() + '\n';

    options.onOutput && options.onOutput(deploymentId, loggable);
    buildLog = buildLog + loggable;

    const result = await ssh.execCommand(...args);
    if (result.code) {
      throw Object.assign(new Error('deployment failed'), {
        cmd: args[0],
        ...result
      });
    }

    return result;
  }

  let ssh;
  try {
    ssh = new NodeSSH();
    await ssh.connect({
      host: dockerHost,
      username: config.sshUsername,
      privateKey: config.sshPrivateKey
    });

    log(chalk.greenBright('Adding ssh key'));
    await execCommand(`
      echo "${deployKey.privatekey}" > /tmp/${deploymentId}.key && chmod 600 /tmp/${deploymentId}.key
    `, { ...output });

    log(chalk.greenBright('Cloning repo from github'));
    await execCommand(`
      ${ignoreSshHostFileCheck} git clone git@github.com:${project.owner}/${project.repo}.git /tmp/${deploymentId}
    `, { ...output });

    log(chalk.greenBright('Checkout correct branch'));
    await execCommand(`${ignoreSshHostFileCheck} git checkout master`, { cwd: `/tmp/${deploymentId}`, ...output });
    await execCommand(`${ignoreSshHostFileCheck} git pull origin master`, { cwd: `/tmp/${deploymentId}`, ...output });

    log(chalk.greenBright('Creating Dockerfile from template'));
    const dockerfileTemplate = await fs.readFile(path.resolve(__dirname, '../dockerfileTemplates/Dockerfile.nodejs12'), 'utf8');
    const dockerfileContent = dockerfileTemplate
      .replace('{{buildCommand}}', project.build_command)
      .replace('{{runCommand}}', project.run_command);
    await fs.writeFile('/tmp/Dockerfile.' + deploymentId, dockerfileContent);
    await ssh.putFile('/tmp/Dockerfile.' + deploymentId, `/tmp/${deploymentId}/Dockerfile`);

    log(chalk.greenBright('Creating .dockerignore'));
    await ssh.putFile(
      path.resolve(__dirname, '../dockerfileTemplates/.dockerignore'),
      `/tmp/${deploymentId}/.dockerignore`
    );

    log(chalk.greenBright('Build docker image'));
    const imageTagName = `${project.name}:${deploymentId}`;
    await execCommand(
      `docker build -t ${imageTagName} .`, { cwd: `/tmp/${deploymentId}`, ...output }
    );

    log(chalk.greenBright('Creating container'));
    const containerCreationResult = await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: '/v1.26/containers/create',
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({
        Env: project.environment_variables ? project.environment_variables.split('\n') : undefined,
        Image: imageTagName,
        ExposedPorts: {
          [`${project.webport}/tcp`]: {}
        },
        HostConfig: {
          PublishAllPorts: true,
          Runtime: 'runsc'
        }
      }),
      httpsAgent: dockerAgent
    });
    const dockerId = containerCreationResult.data.Id;

    log(chalk.greenBright('Starting container'));
    await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${dockerId}/start`,
      httpsAgent: dockerAgent
    });
    log('started');

    log(chalk.greenBright('Discovering allocated port'));
    const dockerPortResult = await execCommand(`docker port ${dockerId}`, { ...output });
    const dockerPort = dockerPortResult.stdout.split(':')[1];

    log(chalk.greenBright('Cleaning up build directory'));
    await execCommand(`rm -rf /tmp/${deploymentId}`, { cwd: '/tmp', ...output });
    await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/tmp', ...output });

    log(chalk.cyanBright('🟢 Your website is now live'));

    await postgres.run(db, `
      UPDATE deployments
      SET buildlog = $2,
          status = 'success',
          dockerhost = $3,
          dockerid = $4,
          dockerport = $5
      WHERE id = $1
    `, [deploymentId, buildLog.trim(), dockerHost, dockerId, dockerPort]);
  } catch (error) {
    console.log(error);
    log(chalk.redBright(error.message));
    log(chalk.greenBright('Cleaning up build directory'));

    try {
      await execCommand(`rm -rf /tmp/${deploymentId}`, { cwd: '/tmp', ...output });
      await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/tmp', ...output });
    } catch (error) {
      console.log(error);
    }

    await postgres.run(db, `
      UPDATE deployments
      SET buildlog = $2,
          status = 'failed'
      WHERE id = $1
    `, [deploymentId, buildLog.trim()]);
  }

  await ssh.dispose();
}

module.exports = deployRepositoryToServer;
