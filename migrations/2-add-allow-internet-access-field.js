module.exports = {
  up: (db) => {
    return Promise.all([
      db.run('ALTER TABLE "services" ADD COLUMN "allowInternetAccess" bool;')
    ]);
  },

  down: (db) => {
    return Promise.all([
      db.run('ALTER TABLE "services" DROP COLUMN "allowInternetAccess";')
    ]);
  }
};
