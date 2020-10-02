const readline = require('readline');

function multilinePrompt () {
  return new Promise((resolve, reject) => {
    const input = [];

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.prompt();

    rl.on('line', function (line) {
      input.push(line);

      if (line.trim() === '') {
        resolve(input.join('\n'));
        rl.close();
      }
    });

    rl.on('close', function (cmd) {
      reject(new Error('multilinePrompt canceled'));
    });
  });
}

module.exports = multilinePrompt;
