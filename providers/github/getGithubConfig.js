function getGithubConfig ({ db, config }) {
  return db.getOne('SELECT * FROM "providers" WHERE "id" = $1', ['github']);
}

module.exports = getGithubConfig;
