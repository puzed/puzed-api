async function prepareGenericSetup (server) {
  const [link, domain, networkRules] = await Promise.all([
    server.db.post('links', {
      providerId: 'rawGit',
      config: {
        installationId: '0'
      },
      dateCreated: Date.now()
    }),

    server.db.post('domains', {
      domain: 'example.com',
      verificationStatus: 'success',
      dateCreated: Date.now()
    }),

    server.db.post('networkRules', {
      title: 'None',
      rules: [
        "'allow'"
      ],
      dateCreated: Date.now()
    })
  ]);

  return {
    link,
    domain,
    networkRules
  };
}

module.exports = prepareGenericSetup;
