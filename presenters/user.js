function presentUser (data) {
  return {
    id: data.id,
    email: data.email,
    githubInstallationId: data.githubInstallationId,
    allowedServiceCreate: data.allowedServiceCreate,
    dateCreated: data.dateCreated
  };
}

module.exports = presentUser;
