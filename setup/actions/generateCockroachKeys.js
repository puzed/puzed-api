const chalk = require('chalk');
const axios = require('axios');

async function generateRootCA (options) {
  console.log('  Generating root ca');
  const containerCreationResult = await axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
    url: '/v1.25/containers/create',
    headers: {
      'content-type': 'application/json'
    },
    data: JSON.stringify({
      Image: 'cockroachdb/cockroach',
      Cmd: ['cert', 'create-ca', '--certs-dir=/data/certs', '--ca-key=/data/ca.key'],
      HostConfig: {
        NetworkMode: options.networkMode,
        AutoRemove: true,
        Mounts: [
          {
            Target: '/data',
            Source: 'cockroachData',
            Type: 'volume',
            ReadOnly: false
          }
        ]
      }
    })
  });

  const dockerId = containerCreationResult.data.Id;

  await axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
    url: `/v1.26/containers/${dockerId}/start`
  });

  return axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
    url: `/v1.24/containers/${dockerId}/wait`
  });
}

async function generateClientCert (options) {
  console.log('  Generating client certs');
  const containerCreationResult = await axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
    url: '/v1.25/containers/create',
    headers: {
      'content-type': 'application/json'
    },
    data: JSON.stringify({
      Image: 'cockroachdb/cockroach',
      Cmd: ['cert', 'create-node', 'cockroachdb-1', 'localhost', '127.0.0.1', '--certs-dir=/data/certs', '--ca-key=/data/ca.key'],
      HostConfig: {
        AutoRemove: true,
        NetworkMode: options.networkMode,
        Mounts: [
          {
            Target: '/data',
            Source: 'cockroachData',
            Type: 'volume',
            ReadOnly: false
          }
        ]
      }
    })
  });

  const dockerId = containerCreationResult.data.Id;

  await axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
    url: `/v1.26/containers/${dockerId}/start`
  });

  await axios({
    method: 'post',
    socketPath: '/var/run/docker.sock',
    url: `/v1.24/containers/${dockerId}/wait`
  });
}

async function generateCockroachKeys (options) {
  try {
    await generateRootCA(options);
    await generateClientCert(options);

    console.log('  done');
  } catch (error) {
    console.log(error.response ? error.response.data : error);
    console.log('  ', chalk.red('fail'), 'could not generate cockroach certs');
    throw error;
  }
}

module.exports = generateCockroachKeys;
