function presentProvider (data) {
  return {
    id: data.id,
    title: data.title,
    driver: data.driver,
    appId: data.appId,
    installUrl: data.installUrl,
    clientId: data.clientId,
    ssoEnabled: data.ssoEnabled,
    ssoUrl: data.ssoUrl
  };
}

module.exports = presentProvider;
