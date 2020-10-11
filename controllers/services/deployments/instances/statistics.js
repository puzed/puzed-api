const writeResponse = require('write-response');

const authenticate = require('../../../../common/authenticate');

async function statisticsRoute ({ db, config }, request, response, tokens) {
  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const statistics = await db.getAll(`
    SELECT
      "cpu",
      "cpuPercent",
      "memory",
      "diskIo",
      "dateCreated"
     FROM "instanceStatistics"
    WHERE "instanceId" = $1
 ORDER BY "dateCreated" ASC
  `, [tokens.instanceId]);

  writeResponse(200, statistics, response);
}

module.exports = statisticsRoute;
