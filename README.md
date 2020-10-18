# puzed-api
[![Build Status](https://travis-ci.org/puzed/puzed-api.svg?branch=master)](https://travis-ci.org/puzed/puzed-api)
[![David DM](https://david-dm.org/puzed/puzed-api.svg)](https://david-dm.org/puzed/puzed-api)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/puzed/puzed-api)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/puzed/puzed-api)](https://github.com/puzed/puzed-api/releases)
[![GitHub](https://img.shields.io/github/license/puzed/puzed-api)](https://github.com/puzed/puzed-api/blob/master/LICENSE)

## Installation
### Install PM2
```bash
npm install --global pm2
```

### Install and run the Client
```bash
git clone https://github.com/puzed/puzed-client.git
cd puzed-client
npm install
pm2 start --name puzed-client npm -- start
```

### Install the API
```bash
git clone https://github.com/puzed/puzed-api.git
cd puzed-api
npm install
```

### Setup the database
```bash
./makeCerts.sh
npm run setup
```

### Run the API
```bash
pm2 start --name puzed-api index.js
```

### After setup
After running all the steps above you can login to your puzed instance and create an account.

The following repl commands may help you:
```javascript
await db.patch('domains', { verificationStatus: 'success' });
await db.patch('users', { allowedServiceCreate: true });
```
