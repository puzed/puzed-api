const fs = require('fs');

const chalk = require('chalk');
const prompts = require('prompts');
const waitPort = require('wait-port');

const createRandomString = require('../common/createRandomString');
const multilinePrompt = require('../common/multilinePrompt');

const deployCockroach = require('./actions/deployCockroach');
const generateCockroachKeys = require('./actions/generateCockroachKeys');
const pullImages = require('./actions/pullImages');
const configurePuzed = require('./actions/configurePuzed');

if (!fs.existsSync('/var/run/docker.sock')) {
  console.log([
    chalk.red('The /var/run/docker.sock file was not found')
  ].join('\n'));

  process.exit(1);
}

async function main () {
  const options = await prompts([{
    type: 'confirm',
    name: 'pullImages',
    message: 'Would you like to pull the latest docker cockroachdb image?',
    initial: true
  }, {
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
    name: 'setupGithub',
    message: 'Would you like to setup a GitHub provider?',
    initial: true
  }, {
    type: (prev, values) => values.setupGithub ? 'text' : null,
    name: 'githubApiUrl',
    message: 'What is the URL to the GitHub API?',
    initial: 'https://api.github.com'
  }, {
    type: (prev, values) => values.setupGithub ? 'text' : null,
    name: 'githubAppId',
    message: 'What is your GitHub App ID?',
    initial: 82621
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

  const jobCount = 5;
  let currentJob = 1;

  console.log(chalk.green(`[${currentJob++}/${jobCount}]`), 'Pulling Images');
  if (options.pullImages) {
    await pullImages(options);
  } else {
    console.log('  skipped');
  }

  console.log(chalk.green(`[${currentJob++}/${jobCount}]`), 'Generating Cockroach Keys');
  await generateCockroachKeys(options);

  console.log(chalk.green(`[${currentJob++}/${jobCount}]`), 'Deploying Cockroach');
  await deployCockroach(options);

  console.log(chalk.green(`[${currentJob++}/${jobCount}]`), 'Waiting for Cockroach to come online');
  await waitPort({ output: 'silent', host: options.internalIpAddress, port: 26257 });

  console.log(chalk.green(`[${currentJob++}/${jobCount}]`), 'Configuring Puzed Instance');
  await configurePuzed(options);
}

main();
