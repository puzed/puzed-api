const verifyInternalSecret = require('../common/verifyInternalSecret');

module.exports = {
  '/users': {
    POST: require('./users/create')
  },

  '/sessions': {
    POST: require('./sessions/create')
  },

  '/sessions/current': {
    GET: require('./sessions/read')
  },

  '/domains': {
    GET: require('./domains/list'),
    POST: require('./domains/create')
  },

  '/networkRules': {
    GET: require('./networkRules/list')
  },

  '/links': {
    GET: require('./links/list')
  },

  '/links/:linkId/repositories': {
    GET: require('./links/repositories/list')
  },

  '/providers': {
    GET: require('./providers/list')
  },

  '/schema/service': {
    GET: require('./schema/service')
  },

  '/services': {
    GET: require('./services/list'),
    POST: require('./services/create')
  },

  '/services/:serviceId': {
    GET: require('./services/read'),
    PUT: require('./services/update'),
    PATCH: require('./services/patch')
  },

  '/services/:serviceId/deployments': {
    GET: require('./deployments/list'),
    POST: require('./deployments/create')
  },

  '/services/:serviceId/deployments/:deploymentId': {
    GET: require('./deployments/read'),
    PATCH: require('./deployments/patch'),
    DELETE: require('./deployments/delete')
  },

  '/services/:serviceId/deployments/:deploymentId/instances': {
    POST: require('./instances/create'),
    GET: require('./instances/list')
  },

  '/services/:serviceId/deployments/:deploymentId/instances/:instanceId': {
    GET: require('./instances/read'),
    DELETE: require('./instances/delete')
  },

  '/services/:serviceId/deployments/:deploymentId/instances/:instanceId/log': {
    GET: require('./instances/log')
  },

  '/services/:serviceId/deployments/:deploymentId/instances/:instanceId/statistics': {
    GET: require('./instances/statistics')
  },

  '/services/:serviceId/deployments/:deploymentId/buildlog': {
    GET: require('./deployments/buildlog')
  },

  '/auth': {
    POST: require('./auth')
  },

  // Internal Routes
  '/internal/instances/:instanceId': {
    DELETE: verifyInternalSecret(require('./internal/instances/delete'))
  },

  '/internal/deployments/:deploymentId/buildlog': {
    GET: verifyInternalSecret(require('./internal/deployments/buildlog'))
  },

  '/internal/instances/:instanceId/livelog': {
    GET: verifyInternalSecret(require('./internal/instances/livelog'))
  }
};
