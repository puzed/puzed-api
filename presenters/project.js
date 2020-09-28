function presentProject (data) {
  return {
    id: data.id,
    name: data.name,
    image: data.image,
    webPort: data.webPort,
    domain: data.domain,
    secrets: typeof data.secrets === 'string' ? JSON.parse(data.secrets) : data.secrets,
    environmentVariables: data.environmentVariables,
    owner: data.owner,
    repo: data.repo,
    runCommand: data.runCommand,
    buildCommand: data.buildCommand,
    userId: data.userId,
    dateCreated: data.dateCreated
  };
}

module.exports = presentProject;
