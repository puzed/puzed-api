const dns = require('dns').promises;

const hint = require('hinton');

async function performDomainValidations ({ db, notify, config }) {
  hint('puzed.domainValidations', 'starting domain validations');

  const domains = await db.getAll('domains', {
    query: {
      guardianServerId: config.serverId,
      verificationStatus: {
        $nin: ['success', 'error']
      }
    }
  });

  for (const domain of domains) {
    hint('puzed.domainValidations', 'verifying domain ' + domain.domain);

    try {
      const txtRecords = await dns.resolveTxt(domain.domain);
      const txtRecordVerified = txtRecords.flat().includes(`${domain.domain}=${domain.verificationCode}`);

      if (txtRecordVerified) {
        await db.patch('domains', {
          verificationStatus: 'success',
          verificationDate: Date.now()
        }, {
          query: { id: domain.id }
        });

        notify.broadcast(domain.id);

        return;
      } else {
        await db.patch('domains', {
          verificationStatus: 'failed',
          verificationDate: Date.now()
        }, {
          query: { id: domain.id }
        });

        notify.broadcast(domain.id);

        return;
      }
    } catch (error) {
      hint('puzed.domainValidations', 'failed to verify domain ' + domain.domain + ' because ' + error.message);
      await db.patch('domains', {
        verificationStatus: 'error',
        verificationDate: Date.now()
      }, {
        query: { id: domain.id }
      });
    }
  }
}

module.exports = performDomainValidations;
