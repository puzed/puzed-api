const postgres = require('postgres-fp/promises');
const NodeSSH = require('node-ssh').NodeSSH;
const githubUsernameRegex = require('github-username-regex');

const selectRandomItemFromArray = require('../common/selectRandomItemFromArray');

async function getLatestCommitHash ({ db, config }, project, options = {}) {
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

  const dockerHost = selectRandomItemFromArray(config.dockerHosts);

  const ignoreSshHostFileCheck = `GIT_SSH_COMMAND="ssh -i /tmp/${project.id}.key -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"`;

  const deployKey = await postgres.getOne(db, `
    SELECT * FROM "githubDeploymentKeys" WHERE "owner" = $1 AND "repo" = $2
  `, [project.owner, project.repo]);

  if (!deployKey) {
    throw new Error('no deploy key');
  }

  let ssh;
  try {
    ssh = new NodeSSH();
    await ssh.connect({
      host: dockerHost,
      username: config.sshUsername,
      privateKey: config.sshPrivateKey
    });

    await ssh.execCommand(`
      echo "${deployKey.privateKey}" > /tmp/${project.id}.key && chmod 600 /tmp/${project.id}.key
    `);

    const result = await ssh.execCommand(`
      ${ignoreSshHostFileCheck} git ls-remote git@github.com:${project.owner}/${project.repo}.git  HEAD | awk '{ print $1}'
    `);

    await ssh.execCommand(`rm -rf /tmp/${project.id}.key`, { cwd: '/tmp' });

    ssh.dispose();

    return result.stdout;
  } catch (error) {
    console.log(error);

    try {
      await ssh.execCommand(`rm -rf /tmp/${project.id}.key`, { cwd: '/tmp' });
    } catch (error) {
      console.log(error);
    }

    ssh.dispose();

    throw new Error('could not get latest commit hash', { statusCode: 500 });
  }
}

module.exports = getLatestCommitHash;
