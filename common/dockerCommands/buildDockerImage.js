const http = require('http');
const ndJsonFe = require('ndjson-fe');

function buildDockerImage (scope, log, data) {
  return new Promise((resolve, reject) => {
    const feed = ndJsonFe();
    let lastLine;

    const buildImageRequest = http.request({
      method: 'post',
      socketPath: scope.config.dockerSocketPath,
      path: '/v1.26/build',
      headers: {
        'content-type': 'application/x-tar'
      }
    }, function (response) {
      response.on('error', reject);
      response.on('end', () => {
        const maybeImageId = lastLine && lastLine.stream && lastLine.stream.trim().split(' ');
        resolve(maybeImageId[2]);
      });
      feed.on('next', row => {
        lastLine = row;
        log(row.error ? row.error : row.stream);
      });
      response.pipe(feed);
    });
    data.pipe(buildImageRequest);
  });
}

module.exports = buildDockerImage;
