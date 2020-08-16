const fs = require('fs');

module.exports = {
  domains: ['localhost'],
  dockerHosts: ['192.168.1.100'],
  rsaPublicKey: fs.readFileSync('./config/id_rsa.pub', 'utf8'),
  rsaPrivateKey: fs.readFileSync('./config/id_rsa', 'utf8'),
  githubApiUrl: 'https://api.github.com',
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
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
