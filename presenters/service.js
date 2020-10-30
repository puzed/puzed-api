function presentService (data) {
  return {
    id: data.id,
    name: data.name,
    linkId: data.linkId,
    providerRepositoryId: data.repo,
    image: data.image,
    memory: data.memory,
    webPort: data.webPort,
    networkRulesId: data.networkRulesId,
    domain: data.domain,
    secrets: typeof data.secrets === 'string' ? JSON.parse(data.secrets) : data.secrets,
    environmentVariables: data.environmentVariables,
    runCommand: data.runCommand,
    buildCommand: data.buildCommand,
    deployments: data.deployments,
    userId: data.userId,
    dateCreated: data.dateCreated
  };
}

module.exports = presentService;
