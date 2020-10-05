const socks = require('socksv5');
const hint = require('../modules/hint');

module.exports = function (scope) {
  const server = socks.createServer(function (info, accept, deny) {
    if (!info.auth || info.auth.user !== 'user' || info.auth.pass !== 'pass') {
      hint('puzed.networkProxy', 'access denifed to user:', info.auth && info.auth.user);
      return deny();
    }

    console.log('socks server is not implemented. will accept everything.');
    accept();
  });

  server.listen(1080, '0.0.0.0', function () {
    hint('puzed.networkProxy', 'network proxy listening on port:', 1080);
  });

  server.useAuth(socks.auth.UserPassword(function (user, password, next) {
    next(true);
  }));

  return {
    close: () => {
      server.close();
    }
  };
};
