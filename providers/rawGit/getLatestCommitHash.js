const executeShellCommand = require('../../common/executeShellCommand');

function validateGitUrl (url) {
  try {
    return new URL(url);
  } catch (error) {
    throw Object.assign(new Error('invalid git url', { statusCode: 422 }));
  }
}

async function getLatestCommitHash (scope, user, service, branch = 'master') {
  const ignoreSshHostFileCheck = 'GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"';

  const gitUrl = await validateGitUrl(service.providerRepositoryId);

  try {
    const result = await executeShellCommand(`
      ${ignoreSshHostFileCheck} git ls-remote ${gitUrl.href} ${branch} | awk '{ print $1}'
    `);
    return result.stdout;
  } catch (error) {
    console.log(error);
    throw new Error('could not get latest commit hash', { statusCode: 500 });
  }
}

module.exports = getLatestCommitHash;
