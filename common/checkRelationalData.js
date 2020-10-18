const mappings = {
  service: { table: 'services' },
  deployment: { table: 'deployments', join: { mapping: 'service', on: 'serviceId' } },
  instance: { table: 'instances', join: { mapping: 'deployment', on: 'deploymentId' } }
};

function getFullOptions (options) {
  const result = {};

  Object.keys(options)
    .forEach(key => {
      result[key] = options[key];

      const mapping = mappings[key];
      if (mapping && mapping.join) {
        result[key][mapping.join.on] = options[mapping.join.mapping].id;
      }
    });

  return result;
}

async function checkRelationalData (db, options) {
  const results = {};

  const fullOptions = getFullOptions(options);

  const promises = Object.keys(fullOptions).map(async key => {
    const resource = await db.getOne(mappings[key].table, {
      query: fullOptions[key]
    });

    if (!resource) {
      throw Object.assign(new Error(key + ' not found'), { statusCode: 404 });
    }

    results[key] = resource;
  });

  await Promise.all(promises);

  return results;
}

module.exports = checkRelationalData;
