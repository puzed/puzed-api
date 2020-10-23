const fs = require('fs');

const chalk = require('chalk');
const ip = require('ip');
const hashText = require('pbkdf2-wrapper/hashText');

const config = require('../config');
const createScope = require('../createScope');

async function configurePuzed (options) {
  try {
    const scope = await createScope(config);

    const hashConfig = {
      encoding: 'hex',
      digest: 'sha256',
      hashBytes: 32,
      saltBytes: 16,
      iterations: 372791
    };

    await Promise.all([
      scope.db.post('settings', {
        key: 'domains',
        value: {
          api: options.apiDomains,
          client: options.clientDomains
        }
      }),

      scope.db.post('settings', {
        key: 'hashConfig',
        value: hashConfig
      }),

      scope.db.post('settings', {
        key: 'installed',
        value: true,
        public: true
      }),

      scope.db.post('settings', {
        key: 'enableRegistrations',
        value: true,
        public: true
      }),

      scope.db.post('settings', {
        key: 'networkMicroManagement',
        value: true,
        public: true
      }),

      scope.db.post('settings', {
        key: 'acmeDirectoryUrl',
        value: options.acmeDirectoryUrl
      }),

      scope.db.post('settings', {
        key: 'forceHttps',
        value: true
      }),

      scope.db.post('settings', {
        key: 'acmeEmail',
        value: options.acmeEmail
      }),

      scope.db.post('settings', {
        key: 'secret',
        value: options.secret
      }),

      scope.db.post('servers', {
        hostname: ip.address(),
        apiPort: '443',
        dateCreated: Date.now()
      }),

      options.setupGithub && scope.db.post('providers', {
        title: 'GitHub',
        driver: 'github',
        apiUrl: 'https://api.github.com',
        appId: options.githubAppId.toString(),
        installUrl: options.githubInstallUrl,
        clientId: options.githubClientId.toString(),
        clientSecret: options.githubClientSecret.toString(),
        clientKey: options.githubClientKey.toString(),
        ssoEnabled: true,
        ssoUrl: 'https://github.com/login/oauth/authorize?scope=repo&client_id=' + options.githubClientId
      }),

      options.setupUser && scope.db.post('users', {
        email: options.userEmail,
        allowedServiceCreate: true,
        password: await hashText(options.userPassword, hashConfig)
      }),

      scope.db.post('networkRules', {
        title: 'None',
        userId: null,
        rules: [
          "'allow'"
        ],
        dateCreated: Date.now()
      }),

      scope.db.post('networkRules', {
        title: 'Access to Package Managers only',
        userId: null,
        rules: [
          "stringEndsWith(hostname, 'npmjs.com') && 'allow'",
          "stringEndsWith(hostname, 'npmjs.org') && 'allow'",
          "stringEndsWith(hostname, 'alpinelinux.org') && 'allow'",
          "'deny'"
        ],
        default: true,
        dateCreated: Date.now()
      }),

      scope.db.post('networkRules', {
        title: 'Full Internet Access',
        userId: null,
        rules: [
          "'allow'"
        ],
        dateCreated: Date.now()
      })
    ]);

    const server = await scope.db.getOne('servers');

    const configFile = require('../config/index.template.js');
    configFile.serverId = server.id;
    fs.writeFileSync('./config/index.js', 'module.exports = ' + JSON.stringify(configFile, null, 2));

    await scope.dataNode.close();
    console.log('  done');
  } catch (error) {
    console.log(error.response ? error.response.data : error);
    console.log('  ', chalk.red('fail'), 'could not configure puzed instance');
    throw error;
  }
}

module.exports = configurePuzed;
