const chalk = require('chalk');
const ip = require('ip');

const config = require('../config');
const createScope = require('../createScope');

async function configurePuzed (options) {
  try {
    const scope = await createScope(config);

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
        value: {
          encoding: 'hex',
          digest: 'sha256',
          hashBytes: 32,
          saltBytes: 16,
          iterations: 372791
        }
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

    await scope.dataNode.close();
    console.log('  done');
  } catch (error) {
    console.log(error.response ? error.response.data : error);
    console.log('  ', chalk.red('fail'), 'could not configure puzed instance');
    throw error;
  }
}

module.exports = configurePuzed;
