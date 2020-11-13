const logs = {};
const listeners = {};

function createLiveLogger (id) {
  function log (...args) {
    const loggable = args.join(', ');

    (listeners[id] || []).forEach(output => output(loggable));

    logs[id] = logs[id] || '';
    logs[id] = logs[id] + loggable;
  }

  log.end = function () {
    (listeners[id] || []).forEach(output => output(null));
    const logData = logs[id];
    delete listeners[id];
    delete logs[id];

    return logData;
  };

  log.getContent = function () {
    return logs[id].trim();
  };

  return log;
}

function getLogData (id) {
  return logs[id].trim();
}

function streamLogData (id, handler) {
  listeners[id] = listeners[id] || [];
  listeners[id].push(handler);
}

function isLoggerActive (id) {
  return !!logs[id];
}

module.exports = {
  createLiveLogger,
  getLogData,
  streamLogData,
  isLoggerActive
};
