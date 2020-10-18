module.exports = {
  hint: '*,-puzed.usageCalculations*,-puzed.healthchecks*,-puzed.autoSwitches*,-puzed.domainValidations*,-puzed.router.proxy*,-puzed.router.request*',
  httpPort: 80,
  httpsPort: 443,
  serverId: '11a0f1ff-3bcd-4795-b530-1238b6536fc2',
  forceHttps: true,
  dockerRuntime: 'runc',
  clientUrl: 'http://localhost:8180',
  dataDirectory: './canhazdata/puzed',
  createDataNode: true
};
