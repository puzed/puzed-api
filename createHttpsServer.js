const https = require('https');
const fs = require('fs');

const acmeUtilities = require('./common/acmeUtilities');
const hint = require('./modules/hint');

const defaultCertificates = {
  key: fs.readFileSync('./config/default.key', 'ascii'),
  cert: fs.readFileSync('./config/default.cert', 'ascii')
};

function createHttpsServer (config, scope, handler) {
  const { db, settings } = scope;

  const httpsServer = https.createServer({
    SNICallback: acmeUtilities.getCertificate(scope, {
      defaultCertificates,
      isAllowedDomain: async domain => {
        const allowedService = await db.getAll('SELECT * FROM services WHERE $1 LIKE domain', [domain]);
        const allowedCertificate = await db.getAll('SELECT * FROM certificates WHERE $1 LIKE domain', [domain]);

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
