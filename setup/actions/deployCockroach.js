const chalk = require('chalk');
const axios = require('axios');

async function deployCockroach (options) {
  try {
    console.log('  creating container');
    const containerCreationResult = await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: '/v1.24/containers/create',
      headers: {
        'content-type': 'application/json'
      },
      data: JSON.stringify({
        Image: 'cockroachdb/cockroach',
        Cmd: ['start', '--certs-dir=/data/certs', '--advertise-addr=localhost', '--cache=.25'],
        ExposedPorts: {
          '26257/tcp': {}
        },
        HostConfig: {
          NetworkMode: options.networkMode,
          Mounts: [
            {
              Target: '/data',
              Source: 'cockroachData',
              Type: 'volume',
              ReadOnly: false
            }
          ],
          PortBindings: {
            '26257/tcp': [{
              HostPort: '26257'
            }]
          }
        }
      })
    });

    const dockerId = containerCreationResult.data.Id;

    console.log('  starting container');
    await axios({
      method: 'post',
      socketPath: '/var/run/docker.sock',
      url: `/v1.26/containers/${dockerId}/start`
    });

    console.log('  done');
  } catch (error) {
    console.log(error.response ? error.response.data : error);
    console.log('  ', chalk.red('fail'), 'could not deploy cockroach');
    throw error;
  }
}

module.exports = deployCockroach;
