# Copyright © 2018 CA. All rights reserved.  CA Confidential.  Please see License.txt file for applicable usage rights and restrictions.
FROM mhart/alpine-node:8

RUN apk add --update openssl

RUN npm i && npm cache verify

WORKDIR /opt

RUN mkdir conf && mkdir html && \
    openssl req -x509 -newkey rsa:2048 -nodes -keyout keytmp.pem -out conf/cert.pem -days 3653 -subj "/C=/OU=/CN=/emailAddress=a@b" && \
    openssl rsa -in keytmp.pem -out conf/key.pem

COPY ["html","/opt/html"]
COPY ["package.json","tsconfig.json","dist/src/*.js","html","/opt/"]

RUN npm install

ENTRYPOINT ["node", "sample-action.js"]
