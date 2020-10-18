async function getUserById ({ db }, userId) {
  const deployment = await db.getOne('users', {
    query: {
      id: userId
    }
  });

  return deployment;
}

module.exports = getUserById;
