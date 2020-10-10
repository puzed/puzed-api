function presentNetworkRules (data) {
  return {
    id: data.id,
    title: data.title,
    rules: data.rules,
    default: data.default,
    userId: data.userId,
    dateCreated: data.dateCreated
  };
}

module.exports = presentNetworkRules;
