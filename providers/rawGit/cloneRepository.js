const executeShellCommand = require('../../common/executeShellCommand');

function validateGitUrl (url) {
  try {
    return new URL(url);
  } catch (error) {
    throw Object.assign(new Error('invalid git url', { statusCode: 422 }));
  }
}

async function cloneRepository (scope, options) {
  const { service, instance, target } = options;

  const ignoreSshHostFileCheck = 'GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"';

  const gitUrl = await validateGitUrl(service.providerRepositoryId);

  try {
    await executeShellCommand(`${ignoreSshHostFileCheck} git clone ${gitUrl.href} ${target}`);
    await executeShellCommand(`${ignoreSshHostFileCheck} git checkout ${instance.commitHash}`, { cwd: target });
  } catch (error) {
    console.log(error);
    throw new Error('could not clone git repository', { statusCode: 500 });
  }
}

module.exports = cloneRepository;
