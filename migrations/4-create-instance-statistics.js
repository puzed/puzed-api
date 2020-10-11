module.exports = {
  up: async (db) => {
    await db.run(`
      CREATE TABLE IF NOT EXISTS "instanceStatistics" (
        "id" varchar PRIMARY KEY,
        "instanceId" varchar,
        "cpuTotal" bigint,
        "cpu" bigint,
        "cpuPercent" decimal,
        "diskIoTotal" bigint,
        "diskIo" bigint,
        "memory" bigint,
        "dateCreated" bigint
      );
    `);
  },

  down: (db) => {
    return Promise.all([
      db.run(`
        DROP TABLE "usageStatistics";
      `)
    ]);
  }
};
