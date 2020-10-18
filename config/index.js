process.env.HINT = process.env.HINT || '*,-puzed.usageCalculations*,-puzed.healthchecks*,-puzed.autoSwitches*,-puzed.domainValidations*,-puzed.router.proxy*,-puzed.router.request*';

module.exports = {
  httpPort: 80,
  httpsPort: 443,
  serverId: 'c912a903-45d3-4d14-84af-b327f92d7e09',
  forceHttps: true,
  dockerRuntime: process.env.DOCKER_RUNTIME || 'runc',
  // routes: {
  //   '/api/billing': process.env.CLIENT_URL || 'http://localhost:8182',
  //   '/billing': process.env.CLIENT_URL || 'http://localhost:8182',
  //   '/': process.env.CLIENT_URL || 'http://localhost:8180'
  // },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8180',
  dataDirectory: './canhazdata/puzed',
  createDataNode: true
};
