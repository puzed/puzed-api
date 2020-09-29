module.exports = function (db) {
  return {
    init: (direction) => {
      return db.run('CREATE TABLE IF NOT EXISTS _migrations (file TEXT PRIMARY KEY)');
    },

    getMigrationState: (id) => {
      return db.getOne('SELECT file FROM _migrations WHERE file = $1', [id]);
    },

    setMigrationUp: (id) => {
      return db.run('INSERT INTO _migrations (file) VALUES ($1)', [id]);
    },

    setMigrationDown: (id) => {
      return db.run('DELETE FROM _migrations WHERE file = $1', [id]);
    },

    handler: (fn) => fn(db)
  };
};
