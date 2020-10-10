const https = require('https');
const fs = require('fs');

const acmeUtilities = require('./common/acmeUtilities');
const hint = require('hinton');

const defaultCertificates = {
  key: fs.readFileSync('./config/default.key', 'ascii'),
  cert: fs.readFileSync('./config/default.cert', 'ascii')
};

function createHttpsServer (config, scope, handler) {
  const { db, settings } = scope;

  const httpsServer = https.createServer({
    SNICallback: acmeUtilities.getCertificateHandler(scope, {
      defaultCertificates,
      isAllowedDomain: async domain => {
        const allowedService = await db.getOne('SELECT * FROM services WHERE $1 LIKE domain LIMIT 1', [domain]);
        const allowedCertificate = await db.getOne('SELECT * FROM certificates WHERE $1 LIKE domain LIMIT 1', [domain]);

        return settings.domains.api.includes(domain) || settings.domains.client.includes(domain) || allowedService || allowedCertificate;
      }
    })
  }, handler);
  httpsServer.on('listening', () => {
    hint('puzed.router', 'listening (https) on port:', httpsServer.address().port);
  });
  httpsServer.listen(config.httpsPort);

  return httpsServer;
}

module.exports = createHttpsServer;
