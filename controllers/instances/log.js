const authenticate = require('../../common/authenticate');
const checkRelationalData = require('../../common/checkRelationalData');

const { format } = require('date-fns');

function formatLogItem (data) {
  const date = new Date(data.slice(0, 30));
  const message = data.slice(31);

  return format(date, 'dd/MM/yyyy HH:mm:ss') + ' ' + message;
}

async function logInstance ({ db, settings, config }, request, response, tokens) {
  request.setTimeout(60 * 60 * 1000);

  const { user } = await authenticate({ db, config }, request.headers.authorization);

  const { instance } = await checkRelationalData(db, {
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

  const liveLog = await db.getAll(`instanceLogs-${instance.id}`, {
    limit: 50,
    order: ['desc(dateCreated)']
  });
  liveLog.sort((a, b) => a.dateCreated < b.dateCreated ? -1 : 1);

  liveLog.forEach(entry => {
    response.write(formatLogItem(entry.data.toString()));
  });

  if (['destroyed', 'failed'].includes(instance.status)) {
    response.end();
    return;
  }

  async function handleNotify (path, collectionId, documentId) {
    const item = await db.getOne(`instanceLogs-${instance.id}`, { query: { id: documentId } });
    response.write(formatLogItem(item.data.toString()));
  }

  db.on(`instanceLogs-${instance.id}`, handleNotify);

  request.on('close', () => {
    db.off(`instanceLogs-${instance.id}`, handleNotify);
  });
}

module.exports = logInstance;
