const axios = require('axios');

async function main () {
  const response = await axios({
    socketPath: '/var/run/docker.sock',
    url: '/v1.40/containers/f44b49795ac2/json'
  });

  console.log(JSON.stringify(Object.values(response.data.NetworkSettings.Ports)[0][0].HostPort, null, 2));
}

main();
