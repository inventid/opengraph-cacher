FROM node:8.5
MAINTAINER Rogier Slag

EXPOSE 7070

RUN groupadd -r luser && useradd -r -g luser luser
RUN mkdir -p /home/luser/.pm2/
RUN chown -R luser.luser /home/luser
RUN npm install -g pm2

RUN mkdir /service
ADD .babelrc /service/
ADD package-lock.json /service/
ADD package.json /service/
RUN cd /service && npm install
ADD src /service/src/
RUN cd /service && npm run dist

USER luser
WORKDIR /service/dist
CMD ["/usr/local/bin/pm2", "start", "index.js",  "--no-daemon", "--instances=max"]

