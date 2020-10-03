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
    GET: require('./domains/list')
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

  '/services': {
    GET: require('./services/list'),
    POST: require('./services/create')
  },

  '/services/:serviceId': {
    GET: require('./services/read')
  },

  '/services/:serviceId/deployments': {
    GET: require('./services/deployments/list'),
    POST: require('./services/deployments/create')
  },

  '/services/:serviceId/deployments/:deploymentId': {
    GET: require('./services/deployments/read'),
    PATCH: require('./services/deployments/patch')
  },

  '/services/:serviceId/deployments/:deploymentId/instances': {
    POST: require('./services/deployments/instances/create'),
    GET: require('./services/deployments/instances/list')
  },

  '/services/:serviceId/deployments/:deploymentId/instances/:instanceId': {
    GET: require('./services/deployments/instances/read'),
    DELETE: require('./services/deployments/instances/delete')
  },

  '/services/:serviceId/deployments/:deploymentId/instances/:instanceId/log': {
    GET: require('./services/deployments/instances/log')
  },

  '/services/:serviceId/deployments/:deploymentId/instances/:instanceId/buildlog': {
    GET: require('./services/deployments/instances/buildlog')
  },

  '/auth': {
    POST: require('./auth')
  },

  // Internal Routes
  '/internal/instances/:instanceId': {
    POST: verifyInternalSecret(require('./internal/instances/create')),
    DELETE: verifyInternalSecret(require('./internal/instances/delete'))
  },

  '/internal/instances/:instanceId/buildlog': {
    GET: verifyInternalSecret(require('./internal/instances/buildlog'))
  },

  '/internal/instances/:instanceId/livelog': {
    GET: verifyInternalSecret(require('./internal/instances/livelog'))
  }
};
