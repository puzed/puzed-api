# puzed-api

## How to run
```bash
docker build -t puzed-api .
docker run --restart always --net=host -it -v /var/run/docker.sock:/var/run/docker.sock -v `pwd`/config:/app/config puzed-api
```
