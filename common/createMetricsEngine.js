const fs = require('fs');
const hint = require('hinton');

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function createMetricsEngine (context) {
  const data = [];

  async function save () {
    if (Object.keys(data).length > 1) {
      const key = Object.keys(data).sort()[0];
      await fs.promises.appendFile('./stats.txt', '\n' + JSON.stringify([key, data[key]]));
      delete data[key];
      hint('puzed.metrics', `appending to stats.txt`);
    }

    setTimeout(save, 5000);
  }
  save();

  function inc (metric) {
    const minute = Math.floor(Date.now() / 60000) * 60000;

    data[minute] = data[minute] || {};
    data[minute][metric] = data[minute][metric] || 0;
    data[minute][metric] = data[minute][metric] + 1;
  }

  return {
    inc
  }
}

module.exports = createMetricsEngine
