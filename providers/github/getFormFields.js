async function getFormFields (scope, userId, fields) {
  const formFields = [
    {
      name: 'providerRepositoryId',
      label: 'Source Code Repository',
      component: 'repositorySelector'
    },
    ...fields
  ];

  return formFields;
}

module.exports = getFormFields;
