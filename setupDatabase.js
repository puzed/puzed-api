const hint = require('./modules/hint');

function setupDatabase (db) {
  hint('puzed.db', 'migrating database');

  return db.run(`
    CREATE TABLE IF NOT EXISTS "projects" (
      "id" varchar,
      "name" varchar,
      "image" varchar,
      "webPort" int,
      "domain" varchar,
      "secrets" text,
      "environmentVariables" varchar,
      "runCommand" varchar,
      "buildCommand" varchar,
      "owner" varchar,
      "repo" varchar,
      "userId" varchar,
      "dateCreated" varchar
    );

    CREATE TABLE IF NOT EXISTS "deployments" (
      "id" varchar,
      "projectId" varchar,
      "title" varchar,
      "commitHash" varchar,
      "branch" varchar,
      "guardianServerId" varchar,
      "stable" bool,
      "autoSwitch" json,
      "dateCreated" varchar
    );

    CREATE TABLE IF NOT EXISTS "instances" (
      "id" varchar,
      "projectId" varchar,
      "deploymentId" varchar,
      "dockerPort" int,
      "dockerHost" varchar,
      "dockerId" varchar,
      "commitHash" varchar,
      "branch" varchar,
      "buildLog" text,
      "liveLog" text,
      "status" varchar,
      "statusDate" varchar,
      "dateCreated" varchar
    );

    CREATE TABLE IF NOT EXISTS "githubDeploymentKeys" (
      "id" varchar,
      "githubKeyId" varchar,
      "owner" varchar,
      "repo" varchar,
      "publicKey" varchar,
      "privateKey" varchar,
      "dateCreated" varchar
    );

    CREATE TABLE IF NOT EXISTS "users" (
      "id" varchar,
      "githubUsername" varchar,
      "allowedProjectCreate" bool,
      "dateCreated" varchar
    );

    CREATE TABLE IF NOT EXISTS "servers" (
      "id" varchar,
      "hostname" varchar,
      "apiPort" varchar,
      "sshUsername" varchar,
      "sshPort" varchar,
      "dateCreated" varchar
    );

    CREATE TABLE IF NOT EXISTS "certificates" (
      "id" varchar,
      "domain" varchar,
      "privatekey" varchar,
      "fullchain" varchar,
      "status" varchar,
      "challenge" varchar,
      "token" varchar
    );
  `);
}

module.exports = setupDatabase;
