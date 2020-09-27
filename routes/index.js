const verifyInternalSecret = require('../common/verifyInternalSecret');

module.exports = {
  '/projects': {
    GET: require('./projects/list'),
    POST: require('./projects/create')
  },

  '/projects/:projectId': {
    GET: require('./projects/read')
  },

  '/projects/:projectId/deployments': {
    GET: require('./projects/deployments/list'),
    POST: require('./projects/deployments/create')
  },

  '/projects/:projectId/deployments/:deploymentId': {
    GET: require('./projects/deployments/read'),
    PATCH: require('./projects/deployments/patch')
  },

  '/projects/:projectId/deployments/:deploymentId/instances': {
    POST: require('./projects/deployments/instances/create'),
    GET: require('./projects/deployments/instances/list')
  },

  '/projects/:projectId/deployments/:deploymentId/instances/:instanceId': {
    GET: require('./projects/deployments/instances/read'),
    DELETE: require('./projects/deployments/instances/delete')
  },

  '/projects/:projectId/deployments/:deploymentId/instances/:instanceId/log': {
    GET: require('./projects/deployments/instances/log')
  },

  '/projects/:projectId/deployments/:deploymentId/instances/:instanceId/buildlog': {
    GET: require('./projects/deployments/instances/buildlog')
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
