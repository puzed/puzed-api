const path = require('path');

const postgres = require('postgres-fp/promises');
const uuidv4 = require('uuid').v4;
const NodeSSH = require('node-ssh').NodeSSH;

const selectRandomItemFromArray = require('../common/selectRandomItemFromArray');

async function deployRepositoryToServer ({ db, config }, options) {
  const deploymentId = uuidv4();
  const dockerHost = selectRandomItemFromArray(config.dockerHosts);

  const ignoreSshHostFileCheck = `GIT_SSH_COMMAND="ssh -i /tmp/${deploymentId}.key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"`;

  let log = '';

  const deployKey = await postgres.getOne(db, `
    SELECT * FROM github_deployment_keys WHERE owner = $1 AND repo = $2
  `, [options.owner, options.repo]);

  const ssh = new NodeSSH();
  await ssh.connect({
    host: dockerHost,
    username: 'root',
    privateKey: config.rsaPrivateKey
  });

  const output = {
    onStdout (chunk) {
      log = log + chunk.toString('utf8');
      process.stdout.write('stdout: ' + chunk.toString('utf8'));
    },

    onStderr (chunk) {
      log = log + chunk.toString('utf8');
      process.stdout.write('stderr: ' + chunk.toString('utf8'));
    }
  };

  async function execCommand (...args) {
    log = log + '\n> ' + args[0]
      .replace(ignoreSshHostFileCheck, '')
      .replace(deployKey.privatekey, '[hidden]')
      .trim() + '\n';

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
    console.log('Adding ssh key');
    await execCommand(`
      echo "${deployKey.privatekey}" > /tmp/${deploymentId}.key && chmod 600 /tmp/${deploymentId}.key
    `, { ...output });

    console.log('Cloning repo from github');
    await execCommand(`
      ${ignoreSshHostFileCheck} git clone git@github.com:${options.owner}/${options.repo}.git /data/${deploymentId}
    `, { ...output });

    console.log('Checkout correct branch');
    await execCommand(`${ignoreSshHostFileCheck} git checkout master`, { cwd: `/data/${deploymentId}`, ...output });
    await execCommand(`${ignoreSshHostFileCheck} git pull origin master`, { cwd: `/data/${deploymentId}`, ...output });

    console.log('Creating Dockerfile from template');
    await ssh.putFile(
      path.resolve(__dirname, '../dockerfileTemplates/Dockerfile.nodejs12'),
      `/data/${deploymentId}/Dockerfile`
    );

    console.log('Build docker image');
    const imageTagName = `${options.name}:${deploymentId}`;
    await execCommand(
      `docker build -t ${imageTagName} .`, { cwd: `/data/${deploymentId}`, ...output }
    );

    console.log('Running container');
    const dockerRunResult = await execCommand(`docker run -d -p ${options.webport} ${imageTagName}`);
    const dockerId = dockerRunResult.stdout.trim();

    console.log('Discovering allocated port');
    const dockerPortResult = await execCommand(`docker port ${dockerId}`);
    const dockerPort = dockerPortResult.stdout.split(':')[1];

    console.log('Cleaning up build directory');
    await execCommand(`rm -rf /data/${deploymentId}`, { cwd: '/data', ...output });
    await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/data', ...output });

    await postgres.insert(db, 'deployments', {
      id: deploymentId,
      projectId: options.id,
      dockerHost,
      dockerId,
      dockerPort,
      buildLog: log.trim(),
      status: 'success'
    });
  } catch (error) {
    console.log(error);
    console.log('Cleaning up build directory');
    await execCommand(`rm -rf /data/${deploymentId}`, { cwd: '/data', ...output });
    await execCommand(`rm -rf /tmp/${deploymentId}.key`, { cwd: '/data', ...output });

    await postgres.insert(db, 'deployments', {
      id: deploymentId,
      projectId: options.id,
      buildLog: log.trim(),
      status: 'failed'
    });
  }

  await ssh.dispose();
}

module.exports = deployRepositoryToServer;
