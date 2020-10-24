module.exports = function (scope) {
  const github = require('./github')(scope);
  const rawGit = require('./rawGit')(scope);

  return {
    github,
    rawGit,

    controllers: {
      ...github.controllers,
      ...rawGit.controllers
    }
  };
};
