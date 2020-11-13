const executeCommandInContainer = require('./executeCommandInContainer');

async function createTextFileInContainer (scope, containerId, destinationPath, content) {
  const data = Buffer.from(content).toString('base64');
  const command = `(echo "${data}" | base64 -d > ${destinationPath})`;

  return executeCommandInContainer(scope, containerId, command);
}

module.exports = createTextFileInContainer;
