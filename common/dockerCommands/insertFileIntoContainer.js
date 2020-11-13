const fs = require('fs');
const executeCommandInContainer = require('./executeCommandInContainer');

async function insertFileIntoContainer (containerId, sourcePath, destinationPath) {
  const data = await fs.readFile(sourcePath, 'base64');
  const command = `(echo "${data}" | base64 -d > ${destinationPath})`;

  return executeCommandInContainer(containerId, command);
}

module.exports = insertFileIntoContainer;
