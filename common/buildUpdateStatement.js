function buildUpdateStatement (tableName, customSql, parameters) {
  const object = parameters.slice(-1)[0];

  const startingIndex = parameters.length;

  const setters = Object.keys(object).map((field, fieldIndex) => {
    return `"${field}" = $${fieldIndex + startingIndex}`;
  }).join(', ');

  const body = Object.values(object).map(value => {
    return typeof value === 'object' ? JSON.stringify(value) : value;
  });

  return {
    sql: `UPDATE "${tableName}" SET ${setters} ` + customSql,
    parameters: [
      ...parameters.slice(0, -1),
      ...body
    ]
  };
}

module.exports = buildUpdateStatement;
