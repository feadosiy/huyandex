FROM node:carbon
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
RUN npm install && mv /usr/src/app/node_modules /node_modules
COPY . /usr/src/app
CMD [ "node", "local.js" ]

