const chalk = require('chalk');
const stringToColour = require('string-to-color');

const names = [];
const skips = [];
let setupEnabledRun;

function setupEnabled () {
  if (setupEnabledRun) {
    return;
  }
  setupEnabledRun = true;

  let namespaces = process.env.HINT;
  const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  const len = split.length;

  for (let i = 0; i < len; i++) {
    if (!split[i]) {
      // ignore empty strings
      continue;
    }

    namespaces = split[i].replace(/\*/g, '.*?');

    if (namespaces[0] === '-') {
      skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

function isEnabled (name) {
  if (name[name.length - 1] === '*') {
    return true;
  }

  let i;
  let len;

  for (i = 0, len = skips.length; i < len; i++) {
    if (skips[i].test(name)) {
      return false;
    }
  }

  for (i = 0, len = names.length; i < len; i++) {
    if (names[i].test(name)) {
      return true;
    }
  }

  return false;
}

function log (namespace, ...messages) {
  const error = new Error();
  const firstBracket = error.stack.split('\n')[3].split('(');
  const position = '.' + firstBracket[1].replace(process.cwd(), '');
  const [file, line] = position.split(':');
  // const functionName = firstBracket[0].replace('at ', '').trim();
  const formattedFunctionName = chalk.hex('#8c8c8c')(`${file}:${line}`);

  const namespaceColour = stringToColour(namespace.split(':')[0]);
  const formattedNamespace = chalk.hex(namespaceColour)(namespace.padEnd(0));
  console.log(formattedNamespace, formattedFunctionName, ...messages);
}

function hint (namespace, ...messages) {
  if (!process.env.HINT) {
    return;
  }

  setupEnabled();

  if (!isEnabled(namespace)) {
    return;
  }

  if (arguments.length > 1) {
    log(namespace, ...messages);
    return;
  }

  return (...messages) => log(namespace, ...messages);
}

hint.red = chalk.red.bind(chalk);
hint.redBright = chalk.redBright.bind(chalk);

module.exports = hint;
