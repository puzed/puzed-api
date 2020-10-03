const execa = require('execa');
const githubUsernameRegex = require('github-username-regex');
const generateAccessToken = require('./generateAccessToken');

async function getLatestCommitHash (scope, user, service, branch = 'master') {
  const { db } = scope;

  const link = await db.getOne(`
    SELECT * FROM "links" WHERE "providerId" = $1 AND "userId" = $2
  `, ['github', user.id]);

  const accessToken = await generateAccessToken(scope, link.config.installationId);

  if (!service.providerRepositoryId) {
    throw Object.assign(new Error('no providerRepositoryId provided'), {
      statusCode: 422,
      body: {
        errors: {
          repo: ['not a valid repo name according to validation policy']
        }
      }
    });
  }

  const owner = service.providerRepositoryId.split('/')[0];
  const repo = service.providerRepositoryId.split('/')[1];

  if (!githubUsernameRegex.test(owner)) {
    throw Object.assign(new Error('invalid github owner'), {
      statusCode: 422,
      body: {
        errors: {
          owner: ['not a valid owner according to validation policy']
        }
      }
    });
  }

  if (!githubUsernameRegex.test(repo)) {
    throw Object.assign(new Error('invalid github repo name'), {
      statusCode: 422,
      body: {
        errors: {
          repo: ['not a valid repo name according to validation policy']
        }
      }
    });
  }

  const ignoreSshHostFileCheck = 'GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"';

  async function execCommand (command, options) {
    const result = await execa('sh', ['-c', command], options);
    if (result.exitCode) {
      throw Object.assign(new Error('instance failed'), {
        cmd: command,
        ...result
      });
    }

    return result;
  }

  try {
    const result = await execCommand(`
      ${ignoreSshHostFileCheck} git ls-remote https://x-access-token:${accessToken}@github.com/${owner}/${repo}.git ${branch} | awk '{ print $1}'
    `);

    return result.stdout;
  } catch (error) {
    console.log(error);
    throw new Error('could not get latest commit hash', { statusCode: 500 });
  }
}

module.exports = getLatestCommitHash;
