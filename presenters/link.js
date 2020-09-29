function presentLink (data) {
  return {
    id: data.id,
    providerId: data.providerId,
    externalUserId: data.externalUserId,
    userId: data.userId,
    config: data.config,
    dateCreated: data.dateCreated
  };
}

module.exports = presentLink;
