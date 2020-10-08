process.env.HINT = process.env.HINT || '*,-puzed.healthchecks*,-puzed.autoSwitches*,-puzed.domainValidations*,-puzed.router.proxy*,-puzed.router.request*';

module.exports = {
  httpPort: 80,
  httpsPort: 443,
  serverId: process.env.PUZED_SERVER_ID || 'first',
  forceHttps: true,
  dockerRuntime: process.env.DOCKER_RUNTIME || 'runc',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8180',
  cockroach: {
    host: process.env.COCKROACH_HOST || '127.0.0.1',
    database: process.env.COCKROACH_DATABASE || 'postgres',
    user: process.env.COCKROACH_USER || 'root',
    port: process.env.COCKROACH_PORT || 26257,
    ssl: {
      rejectUnauthorized: false,
      caFile: process.env.COCKROACH_CA_FILE || './config/cockroachCa.crt',
      keyFile: process.env.COCKROACH_KEY_FILE || './config/cockroachNode.key',
      certFile: process.env.COCKROACH_CERT_FILE || './config/cockroachNode.crt'
    }
  }
};
