function presentUser (data) {
  return {
    id: data.id,
    email: data.email,
    githubInstallationId: data.githubInstallationId,
    allowedProjectCreate: data.allowedProjectCreate,
    dateCreated: data.dateCreated
  };
}

module.exports = presentUser;
