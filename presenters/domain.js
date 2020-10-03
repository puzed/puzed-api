function presentDomain (data) {
  return {
    id: data.id,
    domain: data.domain,
    verificationCode: data.verificationCode,
    userId: data.userId,
    dateCreated: data.dateCreated
  };
}

module.exports = presentDomain;
