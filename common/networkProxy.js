const presh = require('presh');
const memoizee = require('memoizee');
const socks = require('socksv5');

const hint = require('../modules/hint');

const getService = async (scope, serviceId, networkAccessToken) => {
  return scope.db.getOne(`
    SELECT *
      FROM "services"
      WHERE "id" = $1
        AND "networkAccessToken" = $2
  `, [serviceId, networkAccessToken]);
};

const getNetworkRules = async (scope, id) => {
  return scope.db.getOne(`
    SELECT *
      FROM "networkRules"
      WHERE "id" = $1
  `, [id]);
};

module.exports = function (scope) {
  const getServiceCached = memoizee(getService, { maxAge: 30000 });
  const getNetworkRulesCached = memoizee(getNetworkRules, { maxAge: 30000 });

  const server = socks.createServer(async function (info, accept, deny) {
    if (!info.auth) {
      hint('puzed.networkProxy', 'access denied - no auth provided');
      return deny();
    }

    const service = await getServiceCached(scope, info.auth.user, info.auth.pass);

    if (!service) {
      hint('puzed.networkProxy', 'access denied to user:', info.auth && info.auth.user);
      return deny();
    }

    if (!service.networkRulesId) {
      hint('puzed.networkProxy', 'service has no networkRulesId:', info.auth && info.auth.user);
      return deny();
    }

    const networkRules = await getNetworkRulesCached(scope, service.networkRulesId);

    if (!networkRules) {
      hint('puzed.networkProxy', 'network rules could not be found:', info.auth && info.auth.user);
      return deny();
    }

    const ruleResult = networkRules.rules.reduce((result, rule) => {
      const evaluated = presh(rule, {
        hostname: info.dstAddr,
        port: info.dstPort,
        stringEndsWith: (value, test) => (value + '').endsWith(test)
      });

      return result || evaluated.value;
    }, undefined);

    if (ruleResult !== 'allow') {
      deny();
      return;
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
