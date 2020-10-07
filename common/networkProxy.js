const socks = require('socksv5');
const hint = require('../modules/hint');

module.exports = function (scope) {
  const server = socks.createServer(async function (info, accept, deny) {
    if (!info.auth) {
      hint('puzed.networkProxy', 'access denied - no auth provided');
      return deny();
    }

    const service = await scope.db.getOne(`
      SELECT *
        FROM "services"
        WHERE "id" = $1
          AND "networkAccessToken" = $2
    `, [info.auth.user, info.auth.pass]);

    if (!service) {
      hint('puzed.networkProxy', 'access denied to user:', info.auth && info.auth.user);
      return deny();
    }

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
