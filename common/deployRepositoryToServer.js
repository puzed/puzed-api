const path = require('path');

const chalk = require('chalk');
const postgres = require('postgres-fp/promises');
const uuidv4 = require('uuid').v4;
const NodeSSH = require('node-ssh').NodeSSH;

const selectRandomItemFromArray = require('../common/selectRandomItemFromArray');

async function deployRepositoryToServer ({ db, config }, project, options = {}) {
  const deploymentId = uuidv4();
  await postgres.insert(db, 'deployments', {
    id: deploymentId,
    projectId: project.id,
    status: 'pending'
  });

  const dockerHost = selectRandomItemFromArray(config.dockerHosts);

  const ignoreSshHostFileCheck = `GIT_SSH_COMMAND="ssh -i /tmp/${deploymentId}.key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"`;

  let buildLog = '';

  const deployKey = await postgres.getOne(db, `
    SELECT * FROM github_deployment_keys WHERE owner = $1 AND repo = $2
  `, [project.owner, project.repo]);

  if (!deployKey) {
    throw new Error('no deploy key')
  }

  const ssh = new NodeSSH();
  await ssh.connect({
    host: dockerHost,
    username: 'root',
    privateKey: config.rsaPrivateKey
  });

  const output = {
    onStdout (chunk) {
      options.onOutput && options.onOutput(deploymentId, chunk.toString('utf8'));
      process.stdout.write('stdout: ' + chunk.toString('utf8'));
    },

    onStderr (chunk) {
      options.onOutput && options.onOutput(deploymentId, chunk.toString('utf8'));
      process.stdout.write('stderr: ' + chunk.toString('utf8'));
    }
  };

  function log (...args) {
    const loggable = args.join(', ')
    options.onOutput && options.onOutput(deploymentId, '\n' + loggable);

    buildLog = buildLog + loggable;

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

  try {
    log(chalk.greenBright('Adding ssh key'));
    await execCommand(`
      echo "${deployKey.privatekey}" > /tmp/${deploymentId}.key && chmod 600 /tmp/${deploymentId}.key
    `, { ...output });

    log(chalk.greenBright('Cloning repo from github'));
    await execCommand(`
      ${ignoreSshHostFileCheck} git clone git@github.com:${project.owner}/${project.repo}.git /data/${deploymentId}
    `, { ...output });

    log(chalk.greenBright('Checkout correct branch'));
    await execCommand(`${ignoreSshHostFileCheck} git checkout master`, { cwd: `/data/${deploymentId}`, ...output });
    await execCommand(`${ignoreSshHostFileCheck} git pull origin master`, { cwd: `/data/${deploymentId}`, ...output });

    log(chalk.greenBright('Creating Dockerfile from template'));
    await ssh.putFile(
      path.resolve(__dirname, '../dockerfileTemplates/Dockerfile.nodejs12'),
      `/data/${deploymentId}/Dockerfile`
    );

    log(chalk.greenBright('Creating .dockerignore'));
    await ssh.putFile(
      path.resolve(__dirname, '../dockerfileTemplates/.dockerignore'),
      `/data/${deploymentId}/.dockerignore`
    );

    log(chalk.greenBright('Build docker image'));
    const imageTagName = `${project.name}:${deploymentId}`;
    await execCommand(
      `docker build -t ${imageTagName} .`, { cwd: `/data/${deploymentId}`, ...output }
    );

    log(chalk.greenBright('Running container'));
    const dockerRunResult = await execCommand(`docker run -d -p ${project.webport} ${imageTagName}`, { ...output });
    const dockerId = dockerRunResult.stdout.trim();

    log(chalk.greenBright('Discovering allocated port'));
    const dockerPortResult = await execCommand(`docker port ${dockerId}`, { ...output });
    const dockerPort = dockerPortResult.stdout.split(':')[1];

    log(chalk.greenBright('Cleaning up build directory'));
    await execCommand(`rm -rf /data/${deploymentId}`, { cwd: '/data', ...output });
    await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/data', ...output });

    await postgres.run(db, `
      UPDATE deployments
      SET buildlog = $2,
          status = 'success',
          dockerhost = $3,
          dockerid = $4,
          dockerport = $5
      WHERE id = $1
    `, [deploymentId, buildLog.trim(), dockerHost, dockerId, dockerPort])

    log(chalk.cyanBright('🟢 Your website is now live'))
  } catch (error) {
    console.log(error);
    log(chalk.redBright(error.message));
    log(chalk.greenBright('Cleaning up build directory'));
    await execCommand(`rm -rf /data/${deploymentId}`, { cwd: '/data', ...output });
    await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/data', ...output });

    await postgres.run(db, `
      UPDATE deployments
      SET buildlog = $2,
          status = 'failed'
      WHERE id = $1
    `, [deploymentId, buildLog.trim()])
  }

  await ssh.dispose();
}

module.exports = deployRepositoryToServer;
