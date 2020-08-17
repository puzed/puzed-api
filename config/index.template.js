const fs = require('fs');

module.exports = {
  domains: ['api.puzed.com'],
  dockerHosts: ['192.168.1.100'],
  rsaPublicKey: fs.readFileSync('./config/id_rsa.pub', 'utf8'),
  rsaPrivateKey: fs.readFileSync('./config/id_rsa', 'utf8'),
  githubApiUrl: 'https://api.github.com',
  githubClientId: 'xxx',
  githubClientSecret: 'yyy',
  email: 'me@markwylde.com',
  directoryUrl: 'https://acme-staging-v02.api.letsencrypt.org/directory',
  // directoryUrl: 'https://acme-v02.api.letsencrypt.org/directory',
  cockroach: {
    host: '192.168.1.100',
    database: 'postgres',
    user: 'root',
    port: 26257,
    ssl: {
      rejectUnauthorized: false,
      ca: fs.readFileSync('./config/ca.crt').toString(),
      key: fs.readFileSync('./config/client.key').toString(),
      cert: fs.readFileSync('./config/client.crt').toString()
    }
  }
};
