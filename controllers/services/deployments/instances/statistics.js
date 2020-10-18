const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');
const checkRelationalData = require('../../../../common/checkRelationalData');

async function statisticsRoute ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  await checkRelationalData(db, {
    service: {
      id: tokens.serviceId,
      userId: user.id
    },
    deployment: {
      id: tokens.deploymentId
    },
    instance: {
      id: tokens.instanceId
    }
  });

  const millisecondsInAnHour = 3600000;

  const statistics = await db.getAll('instanceStatistics', {
    query: {
      dateCreated: {
        $gt: Date.now() - millisecondsInAnHour
      },
      instanceId: tokens.instanceId
    },
    order: 'asc(dateCreated)'
  });

  writeResponse(200, statistics, response);
}

module.exports = statisticsRoute;
