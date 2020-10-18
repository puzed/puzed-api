const fs = require('fs');

const chalk = require('chalk');
const prompts = require('prompts');

const createRandomString = require('../common/createRandomString');
const multilinePrompt = require('../common/multilinePrompt');

const configurePuzed = require('./configurePuzed');

if (!fs.existsSync('/var/run/docker.sock')) {
  console.log([
    chalk.red('The /var/run/docker.sock file was not found')
  ].join('\n'));

  process.exit(1);
}

async function main () {
  const options = await prompts([{
    type: 'list',
    name: 'apiDomains',
    message: 'What domains will the API be using? (separate with commas)',
    initial: 'api.puzed.test'
  }, {
    type: 'list',
    name: 'clientDomains',
    message: 'What domains will the Web Client be using? (separate with commas)',
    initial: 'puzed.test'
  }, {
    type: 'autocomplete',
    name: 'acmeDirectoryUrl',
    message: 'What ACME provider would you like to use?',
    choices: [
      { title: 'None (self signed certs only)', value: 'none' },
      { title: 'LetsEncrypt (staging)', value: 'https://acme-staging-v02.api.letsencrypt.org/directory' },
      { title: 'LetsEncrypt (production)', value: 'https://acme-v02.api.letsencrypt.org/directory' }
    ]
  }, {
    type: 'text',
    name: 'acmeEmail',
    message: 'What email address do you want to use for ACME?',
    initial: 'test@example.com'
  }, {
    type: 'confirm',
    name: 'setupUser',
    message: 'Would you like to create a user?',
    initial: true
  }, {
    type: (prev, values) => values.setupUser ? 'text' : null,
    name: 'userEmail',
    message: 'What email address will the account use?',
    initial: 'me@markwylde.com'
  }, {
    type: (prev, values) => values.setupUser ? 'password' : null,
    name: 'userPassword',
    message: 'What password will the account use?',
    initial: ''
  }, {
    type: 'confirm',
    name: 'setupGithub',
    message: 'Would you like to setup a GitHub provider?',
    initial: true
  }, {
    type: (prev, values) => values.setupGithub ? 'text' : null,
    name: 'githubAppId',
    message: 'What is your GitHub App ID?',
    initial: 82621
  }, {
    type: (prev, values) => values.setupGithub ? 'text' : null,
    name: 'githubInstallUrl',
    message: 'What is the URL to install your GitHub app?',
    initial: 'https://github.com/apps/puzed-local/installations/new'
  }, {
    type: (prev, values) => values.setupGithub ? 'text' : null,
    name: 'githubClientId',
    message: 'What is your GitHub Client ID?',
    initial: 'Iv1.6e1c81a97956c1d1'
  }, {
    type: (prev, values) => values.setupGithub ? 'text' : null,
    name: 'githubClientSecret',
    message: 'What is your GitHub Client Secret?',
    initial: 'super secret key'
  }], {
    onCancel: () => {
      console.log(chalk.red('You must complete all questions to continue with the installation'));
      process.exit(1);
    }
  });

  options.secret = await createRandomString(40);

  if (options.setupGithub) {
    console.log(chalk.cyan('?'), chalk.bold('What is your GitHub Client Key'));
    options.githubClientKey = await multilinePrompt();
  }

  console.log(chalk.green('Configuring Puzed Instance'));
  await configurePuzed(options);
}

main();
