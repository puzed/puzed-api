const execa = require('execa');

async function executeShellCommand (command, options) {
  const result = await execa('sh', ['-c', command], options);
  if (result.exitCode) {
    throw Object.assign(new Error('instance failed'), {
      cmd: command,
      ...result
    });
  }

  return result;
}

module.exports = executeShellCommand;
