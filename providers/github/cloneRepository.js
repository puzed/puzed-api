const execa = require('execa');
const githubUsernameRegex = require('github-username-regex');
const generateAccessToken = require('./generateAccessToken');

async function cloneRepository (scope, options) {
  const { db } = scope;
  const { project, instance, target } = options;

  const user = await db.getOne(`
    SELECT * FROM "users" WHERE "id" = $1
  `, [project.userId]);

  const { githubInstallationId } = await db.getOne(`
    SELECT "githubInstallationId" FROM "githubUserLinks" WHERE "userId" = $1
  `, [user.id]);

  const accessToken = await generateAccessToken(scope, githubInstallationId);

  const owner = project.providerRepositoryId.split('/')[0];
  const repo = project.providerRepositoryId.split('/')[1];

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
    await execCommand(`${ignoreSshHostFileCheck} git clone https://x-access-token:${accessToken}@github.com/${owner}/${repo}.git ${target}`);
    await execCommand(`${ignoreSshHostFileCheck} git checkout ${instance.commitHash}`, { cwd: target });
  } catch (error) {
    console.log(error);
    throw new Error('could not get latest commit hash', { statusCode: 500 });
  }
}

module.exports = cloneRepository;
