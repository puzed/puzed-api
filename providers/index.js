module.exports = function (scope) {
  const github = require('./github')(scope);

  return {
    github,

    controllers: {
      ...github.controllers
    }
  };
};
