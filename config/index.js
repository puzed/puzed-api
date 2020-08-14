const fs = require('fs');

module.exports = {
  rsaPublicKey: fs.readFileSync('./config/id_rsa.pub', 'utf8'),
  githubApiUrl: 'https://api.github.com',
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  cockroach: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'postgres',
    port: 26257
  }
};
