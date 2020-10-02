function presentProvider (data) {
  return {
    id: data.id,
    driver: data.driver,
    appId: data.appId,
    clientId: data.clientId
  };
}

module.exports = presentProvider;
