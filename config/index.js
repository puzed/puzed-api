const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
process.env.HINT = process.env.HINT || '*,-puzed.healthchecks*,-puzed.router.proxy*,-puzed.router.request*';

module.exports = {
  httpPort: 80,
  httpsPort: 443,
  serverId: process.env.PUZED_SERVER_ID || 'first',
  forceHttps: true,
  domains: {
    api: (process.env.PUZED_API_DOMAINS || 'api.puzed.test').split(','),
    client: (process.env.PUZED_CLIENT_DOMAINS || 'puzed.test').split(',')
  },
  dockerRuntime: process.env.DOCKER_RUNTIME || 'runc',
  internalSecret: process.env.PUZED_SECRET,
  responsibilities: [process.env.SELF_IP_ADDRESS],
  email: process.env.ACME_EMAIL || 'me@markwylde.com',
  directoryUrl: process.env.ACME_URL || 'https://acme-staging-v02.api.letsencrypt.org/directory',
  // directoryUrl: 'https://acme-staging-v02.api.letsencrypt.org/directory',
  // directoryUrl: 'https://acme-v02.api.letsencrypt.org/directory',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8080',
  cockroach: {
    host: process.env.COCKROACH_HOST || '127.0.0.1',
    database: process.env.COCKROACH_DATABASE || 'postgres',
    user: process.env.COCKROACH_USER || 'root',
    port: process.env.COCKROACH_PORT || 26257,
    ssl: {
      rejectUnauthorized: false,
      ca: fs.readFileSync(process.env.COCKROACH_CA_FILE || './config/ca.crt').toString(),
      key: fs.readFileSync(process.env.COCKROACH_KEY_FILE || './config/client.key').toString(),
      cert: fs.readFileSync(process.env.COCKROACH_CERT_FILE || './config/client.crt').toString()
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
