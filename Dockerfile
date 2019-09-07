FROM node:10.14.1 AS installer

WORKDIR /usr/src/WebPageAlerter/build
COPY package*.json ./

RUN npm install --production
RUN npm install -g --production typescript

# ----------------------------

FROM installer AS builder

WORKDIR /usr/src/WebPageAlerter/build

COPY ./src src
COPY tsconfig.json .
RUN tsc

# ----------------------------

FROM node:10.14.1-slim

WORKDIR /app/WebPageAlerter

COPY --from=builder /usr/src/WebPageAlerter/build/dist dist
COPY --from=builder /usr/src/WebPageAlerter/build/node_modules node_modules
COPY package*.json ./

CMD [ "node", "dist/main.js" ]
