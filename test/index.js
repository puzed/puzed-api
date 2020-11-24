require('tape').onFailure(() => {
  process.exit(1);
});

require('./jobs/healthchecks');
require('./controllers/users/create');
require('./controllers/sessions/create');
require('./controllers/sessions/read');
require('./controllers/providers/list');
require('./controllers/networkRules/list');
require('./controllers/services/create');
require('./controllers/services/update');
require('./controllers/services/patch');
require('./controllers/services/list');
require('./controllers/deployments/create');
require('./controllers/deployments/delete');
require('./controllers/schema/service');
