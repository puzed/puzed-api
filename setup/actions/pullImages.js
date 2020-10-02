const chalk = require('chalk');
const axios = require('axios');

function pullImage (imageName) {
  console.log('  pulling', imageName);

  return axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
    url: `/v1.24/images/create?fromImage=${imageName}&tag=latest`
  });
}

async function pullImages () {
  try {
    await Promise.all([
      pullImage('cockroachdb/cockroach'),
      pullImage('alpine')
    ]);

    console.log('  done');
  } catch (error) {
    console.log(error.response ? error.response.data : error);
    console.log('  ', chalk.red('fail'), 'could not pull all images');
    throw error;
  }
}

module.exports = pullImages;
