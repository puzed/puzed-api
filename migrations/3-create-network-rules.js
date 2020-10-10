const uuid = require('uuid').v4;

const buildInsertStatement = require('../common/buildInsertStatement.js');

module.exports = {
  up: async (db) => {
    function run (query) {
      return db.run(query.sql, query.parameters);
    }

    await db.run(`
      CREATE TABLE IF NOT EXISTS "networkRules" (
        "id" varchar PRIMARY KEY,
        "title" varchar,
        "rules" json,
        "default" bool,
        "userId" varchar,
        "dateCreated" bigint
      );
    `);

    return Promise.all([
      run(
        buildInsertStatement('networkRules', {
          id: uuid(),
          title: 'None',
          userId: null,
          rules: JSON.stringify([
            "'allow'"
          ]),
          dateCreated: Date.now()
        })
      ),

      run(
        buildInsertStatement('networkRules', {
          id: uuid(),
          title: 'Access to Package Managers only',
          userId: null,
          rules: JSON.stringify([
            "stringEndsWith(hostname, 'npmjs.com') && 'allow'",
            "stringEndsWith(hostname, 'alpinelinux.org') && 'allow'",
            "'deny'"
          ]),
          default: true,
          dateCreated: Date.now()
        })
      ),

      run(
        buildInsertStatement('networkRules', {
          id: uuid(),
          title: 'Full Internet Access',
          userId: null,
          rules: JSON.stringify([
            "'allow'"
          ]),
          dateCreated: Date.now()
        })
      ),

      db.run('ALTER TABLE "services" DROP COLUMN "allowInternetAccess";'),
      db.run('ALTER TABLE "services" ADD COLUMN "networkRulesId" varchar;')
    ]);
  },

  down: (db) => {
    return Promise.all([
      db.run(`
        DROP TABLE "networkRules";
      `),
      db.run('ALTER TABLE "services" ADD COLUMN "allowInternetAccess" bool;'),
      db.run('ALTER TABLE "services" DROP COLUMN "networkRulesId";')
    ]);
  }
};
