FROM node:12

COPY  ./__puzedVendor__/proxychains4/runtime.tar /usr/local/bin/proxychains.tar
COPY  ./__puzedVendor__/proxychains4/proxychains.conf /opt/proxychains4/proxychains.conf
RUN cd /usr/local/bin && tar xvf proxychains.tar
RUN rm /usr/local/bin/proxychains.tar

ENV PROXYCHAINS_CONF_FILE=/opt/proxychains4/proxychains.conf
RUN echo "socks5 192.168.1.8 1080 6c196144-c72b-40e2-9fae-ccdc012eefb9 ZgbPAvqvf32xQ85cjBS6m1Rfqt37BaHxUXnohll8" >> /opt/proxychains4/proxychains.conf

WORKDIR /app

COPY package*.json ./

RUN proxychains -q sh -c "npm set progress=false"

COPY . .

RUN proxychains -q sh -c "npm install"

CMD sleep 60 || proxychains sh -c "npm run start"