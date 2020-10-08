module.exports = {
  up: (db) => {
    return Promise.all([
      db.run(`
        CREATE TABLE IF NOT EXISTS "services" (
          "id" varchar PRIMARY KEY,
          "name" varchar,
          "linkId" varchar,
          "providerRepositoryId" varchar,
          "image" varchar,
          "webPort" bigint,
          "domain" varchar,
          "secrets" text,
          "environmentVariables" varchar,
          "runCommand" varchar,
          "buildCommand" varchar,
          "networkAccessToken" varchar,
          "userId" varchar,
          "dateCreated" bigint
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "deployments" (
          "id" varchar PRIMARY KEY,
          "serviceId" varchar,
          "title" varchar,
          "commitHash" varchar,
          "branch" varchar,
          "guardianServerId" varchar,
          "stable" bool,
          "autoSwitch" json,
          "dateCreated" bigint
        );
      `), db.run(`      
        CREATE TABLE IF NOT EXISTS "instances" (
          "id" varchar PRIMARY KEY,
          "serviceId" varchar,
          "deploymentId" varchar,
          "serverId" varchar,
          "dockerPort" bigint,
          "dockerId" varchar,
          "commitHash" varchar,
          "branch" varchar,
          "buildLog" text,
          "liveLog" text,
          "status" varchar,
          "statusDate" bigint,
          "dateCreated" bigint
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" varchar PRIMARY KEY,
          "email" varchar,
          "password" varchar,
          "allowedServiceCreate" bool,
          "dateCreated" bigint
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "sessions" (
          "id" varchar PRIMARY KEY,
          "secret" varchar,
          "userId" varchar,
          "dateCreated" bigint
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "servers" (
          "id" varchar PRIMARY KEY,
          "hostname" varchar,
          "apiPort" varchar,
          "dateCreated" bigint
        );
        `), db.run(`
        CREATE TABLE IF NOT EXISTS "providers" (
          "id" varchar PRIMARY KEY,
          "title" varchar,
          "driver" varchar,
          "apiUrl" varchar,
          "appId" varchar,
          "installUrl" varchar,
          "clientId" varchar,
          "clientSecret" varchar,
          "clientKey" varchar,
          "ssoEnabled" bool,
          "ssoUrl" varchar
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "links" (
          "id" varchar PRIMARY KEY,
          "providerId" varchar,
          "externalUserId" varchar,
          "userId" varchar,
          "config" json,
          "dateCreated" bigint
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "settings" (
          "key" varchar PRIMARY KEY,
          "value" json,
          "public" bool
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "domains" (
          "id" varchar PRIMARY KEY,
          "domain" varchar,
          "userId" varchar,
          "verificationStatus" varchar,
          "verificationCode" varchar,
          "verificationDate" bigint,
          "guardianServerId" varchar,
          "dateCreated" bigint
        );
      `), db.run(`
        CREATE TABLE IF NOT EXISTS "certificates" (
          "id" varchar PRIMARY KEY,
          "domain" varchar,
          "privatekey" varchar,
          "fullchain" varchar,
          "status" varchar,
          "challenge" varchar,
          "token" varchar,
          "dateRenewal" bigint,
          "dateCreated" bigint
        );
      `)
    ]);
  },

  down: (db) => {
    return Promise.all([
      db.run(`
        DROP TABLE "services";
        DROP TABLE "instances";
        DROP TABLE "users";
        DROP TABLE "sessions";
        DROP TABLE "servers";
        DROP TABLE "links";
        DROP TABLE "settings";
        DROP TABLE "certificates";
      `)
    ]);
  }
};
