async function authenticate ({ db, config }, authorization) {
  if (!authorization) {
    throw Object.assign(new Error('unauthorized'), { statusCode: 401 });
  }

  const session = await db.getOne('SELECT * FROM "sessions" WHERE "secret" = $1', [authorization.replace('token ', '')]);
  if (!session) {
    throw Object.assign(new Error('unauthorized'), { statusCode: 401 });
  }

  const user = await db.getOne('SELECT * FROM users WHERE "id" = $1', [session.userId]);

  if (!user) {
    throw Object.assign(new Error('unauthorized'), { statusCode: 401 });
  }

  return {
    session,
    user
  };
}

module.exports = authenticate;
