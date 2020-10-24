async function authenticate ({ db, config }, authorization) {
  if (!authorization) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  const session = await db.getOne('sessions', {
    query: {
      secret: authorization.replace('token ', '')
    }
  });

  if (!session) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  const user = await db.getOne('users', {
    query: {
      id: session.userId
    }
  });

  if (!user) {
    throw Object.assign(new Error('unauthorised'), { statusCode: 401 });
  }

  return {
    session,
    user
  };
}

module.exports = authenticate;
