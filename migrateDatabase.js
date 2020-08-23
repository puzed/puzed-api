const postgres = require('postgres-fp/promises');

function migrateDatabase (db) {
  return postgres.run(db, `
    CREATE TABLE IF NOT EXISTS projects (
      id varchar,
      name varchar,
      image varchar,
      webport varchar,
      domain varchar,
      owner varchar,
      repo varchar,
      username varchar,
      datecreated varchar
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id varchar,
      projectid varchar,
      dockerport varchar,
      dockerhost varchar,
      dockerid varchar,
      buildlog text,
      status varchar,
      datecreated varchar
    );

    CREATE TABLE IF NOT EXISTS github_deployment_keys (
      id varchar,
      github_key_id varchar,
      owner varchar,
      repo varchar,
      publickey varchar,
      privatekey varchar,
      datecreated varchar
    );
  `);
}

module.exports = migrateDatabase;
