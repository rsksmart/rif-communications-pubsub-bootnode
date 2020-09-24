FROM node:lts-buster as builder

ARG REPO=rsksmart/rif-communications-pubsub-node
ARG PUBSUB_VERSION=grpc-api


RUN apt update
RUN apt install software-properties-common -y

ADD https://api.github.com/repos/${REPO}/commits/${PUBSUB_VERSION} /dev/null

RUN git clone -b ${PUBSUB_VERSION} https://github.com/${REPO} /app/pubsub --depth 1

RUN ls /app/pubsub

RUN apt-get install libssl-dev build-essential automake pkg-config libtool libffi-dev libgmp-dev libyaml-cpp-dev -y

WORKDIR /app/pubsub

RUN npm install

COPY ./config /app/pubsub/config
COPY ./start.sh /app/pubsub
COPY ./run.exp /app/pubsub
RUN chmod +x /app/pubsub/run.exp /app/pubsub/start.sh

ENTRYPOINT "/app/pubsub/start.sh"