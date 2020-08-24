const fs = require('fs');

module.exports = {
  httpPort: 80,
  httpsPort: 443,
  domains: {
    api: ['api.puzed.com'],
    client: ['puzed.com', 'www.puzed.com']
  },
  dockerHosts: ['192.168.1.100'],
  sshUsername: 'root',
  sshPublicKey: fs.readFileSync('./config/id_rsa.pub', 'utf8'),
  sshPrivateKey: fs.readFileSync('./config/id_rsa', 'utf8'),
  githubApiUrl: 'https://api.github.com',
  githubClientId: 'YOUR_GITHUB_CLIENT_ID',
  githubClientSecret: 'YOUR_GITHUB_CLIENT_SECRET',
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
  }
};
