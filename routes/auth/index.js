const axios = require('axios');

async function auth ({ config }, request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  try {
    const oauthResponse = await axios({
      method: 'post',
      url: `https://github.com/login/oauth/access_token?client_id=${config.githubClientId}&client_secret=${config.githubClientSecret}&code=${token}`,
      headers: {
        accept: 'application/json'
      },
      data: JSON.stringify({
        scope: 'repo'
      })
    });

    if (oauthResponse.data.error) {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(oauthResponse.data));
      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(oauthResponse.data));
  } catch (error) {
    console.log(error);
    response.writeHead(500);
    response.end('Unexpected server error');
  }
}

module.exports = auth;
