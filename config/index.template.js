const fs = require('fs');

process.env.HINT = process.env.HINT || '*,-puzed.healthchecks*,-puzed.router.proxy*,-puzed.router.request*';

module.exports = {
  httpPort: 80,
  httpsPort: 443,
  serverId: 'manual-local',
  forceHttps: true,
  domains: {
    api: ['api.puzed.com'],
    client: ['puzed.com', 'www.puzed.com']
  },
  dockerRuntime: 'runc',
  internalSecret: 'CHANGE_ME',
  responsibilities: ['127.0.0.1'],
  email: 'YOUR_EMAIL_ADDRESS_FOR_ACME',
  directoryUrl: 'https://acme-staging-v02.api.letsencrypt.org/directory',
  // directoryUrl: 'https://acme-v02.api.letsencrypt.org/directory',
  cockroach: {
    host: '192.168.1.100',
    database: 'puzed',
    user: 'root',
    port: 26257,
    ssl: {
      rejectUnauthorized: false,
      ca: fs.readFileSync('./config/ca.crt').toString(),
      key: fs.readFileSync('./config/client.key').toString(),
      cert: fs.readFileSync('./config/client.crt').toString()
    }
  },
  hashConfig: {
    encoding: 'hex',
    digest: 'sha256',
    hashBytes: 32,
    saltBytes: 16,
    iterations: 372791
  }
};
