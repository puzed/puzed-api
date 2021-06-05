const fs = require('fs');
const hint = require('hinton');

const average = (array) => array.reduce((a, b) => a + b) / array.length;

function createMetricsEngine (context) {
  const data = {
    increments: {},
    sets: {}
  }
  let stopping = false;

  async function save () {
    if (stopping) {
      return;
    }

    if (Object.keys(data.increments).length > 1) {
      const key = Object.keys(data.increments).sort()[0];
      await fs.promises.appendFile('./stats.increments.txt', '\n' + JSON.stringify([key, data.increments[key]]));
      delete data.increments[key];
      hint('puzed.metrics', `appending to stats.increments.txt`);
    }

    if (Object.keys(data.sets).length > 1) {
      const time = Object.keys(data.sets).sort()[0];

      const sets = Object.keys(data.sets[time]).forEach(metric => {
        data.sets[time][metric] = [
          Math.min(...data.sets[time][metric]).toFixed(2),
          average(data.sets[time][metric]).toFixed(2),
          Math.max(...data.sets[time][metric]).toFixed(2)
        ]
      });

      await fs.promises.appendFile('./stats.sets.txt', '\n' + JSON.stringify([time, data.sets[time]]));
      delete data.sets[time];
      hint('puzed.metrics', `appending to stats.sets.txt`);
    }


    setTimeout(save, 5000);
  }
  save();

  function inc (metric) {
    const minute = Math.floor(Date.now() / 60000) * 60000;

    data.increments[minute] = data.increments[minute] || {};
    data.increments[minute][metric] = data.increments[minute][metric] || 0;
    data.increments[minute][metric] = data.increments[minute][metric] + 1;
  }

  function set (metric, value) {
    const minute = Math.floor(Date.now() / 60000) * 60000;

    data.sets[minute] = data.sets[minute] || {};
    data.sets[minute][metric] = data.sets[minute][metric] || [];
    data.sets[minute][metric].push(value);
  }

  return {
    inc,
    set,
    stop: () => {
      stopping = true;
    }
  }
}

module.exports = createMetricsEngine
