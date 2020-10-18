function getGithubConfig ({ db, config }) {
  return db.getOne('providers', {
    query: {
      driver: 'github'
    }
  });
}

module.exports = getGithubConfig;
