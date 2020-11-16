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
  const missing = [];

  const fullOptions = getFullOptions(options);

  const promises = Object.keys(fullOptions).map(async key => {
    results[key] = await db.getOne(mappings[key].table, {
      query: fullOptions[key]
    });

    if (!results[key]) {
      missing.push(key);
    }
  });

  await Promise.all(promises);

  const missingRelationships = Object.values(results).filter(key => !key);
  if (missingRelationships.length > 0) {
    throw Object.assign(new Error(missing.join(',') + ' not found'), { statusCode: 404 });
  }
  return results;
}

module.exports = checkRelationalData;
