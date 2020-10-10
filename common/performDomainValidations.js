const dns = require('dns').promises;

const hint = require('hinton');

async function performDomainValidations ({ db, notify, config }) {
  hint('puzed.domainValidations', 'starting domain validations');

  const domains = await db.getAll(`
   SELECT *
     FROM "domains"
    WHERE "guardianServerId" = $1
      AND (
        ("verificationStatus" != 'success' AND "verificationStatus" != 'error')
        OR
        ("verificationStatus" IS NULL)
      )
  `, [config.serverId]);

  for (const domain of domains) {
    hint('puzed.domainValidations', 'verifying domain ' + domain.domain);

    try {
      const txtRecords = await dns.resolveTxt(domain.domain);
      const txtRecordVerified = txtRecords.flat().includes(`${domain.domain}=${domain.verificationCode}`);

      if (txtRecordVerified) {
        await db.run(`
          UPDATE "domains"
              SET "verificationStatus" = 'success', "verificationDate" = $2
            WHERE "id" = $1
        `, [domain.id, Date.now()]);

        notify.broadcast(domain.id);

        return;
      } else {
        await db.run(`
          UPDATE "domains"
              SET "verificationStatus" = 'failed', "verificationDate" = $2
            WHERE "id" = $1
        `, [domain.id, Date.now()]);

        notify.broadcast(domain.id);

        return;
      }
    } catch (error) {
      hint('puzed.domainValidations', 'failed to verify domain ' + domain.domain + ' because ' + error.message);
      await db.run(`
        UPDATE "domains"
            SET "verificationStatus" = 'error', "verificationDate" = $2
          WHERE "id" = $1
      `, [domain.id, Date.now()]);
    }
  }
}

module.exports = performDomainValidations;
