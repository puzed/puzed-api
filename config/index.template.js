module.exports = {
  hint: '*,-puzed.scaling*,-puzed.usageCalculations*,-puzed.healthchecks*,-puzed.autoSwitches*,-puzed.domainValidations*,-puzed.router.proxy*,-puzed.router.request*',
  httpPort: 80,
  httpsPort: 443,
  serverId: 'server-uuid-here',
  forceHttps: true,
  dockerRuntime: 'runc',
  clientUrl: 'http://localhost:8180',
  dataDirectory: './canhazdata/puzed',
  createDataNode: true
};
