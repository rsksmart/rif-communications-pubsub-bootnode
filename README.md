# RIF Communications PubSub bootnode

[![CircleCI](https://flat.badgen.net/circleci/github/rsksmart/rif-communications-pubsub-node/master)](https://circleci.com/gh/rsksmart/rif-communications-pubsub-node/)
[![Dependency Status](https://david-dm.org/rsksmart/rif-communications-pubsub-node.svg?style=flat-square)](https://david-dm.org/rsksmart/rif-communications-pubsub-node)
[![](https://img.shields.io/badge/made%20by-IOVLabs-blue.svg?style=flat-square)](http://iovlabs.org)
[![](https://img.shields.io/badge/project-RIF%20Storage-blue.svg?style=flat-square)](https://www.rifos.org/)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
[![Managed by tAsEgir](https://img.shields.io/badge/%20managed%20by-tasegir-brightgreen?style=flat-square)](https://github.com/auhau/tasegir)
![](https://img.shields.io/badge/npm-%3E%3D6.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D10.0.0-orange.svg?style=flat-square)

> Simple boot node for RIF Communications PubSub

The aim to provide a libp2p node which serves as bootstrap node for projects which use [`rif-commmunications-pubsub`](https://github.com/rsksmart/rif-communications-pubsub). 

This can be also used for local development where you can define the list of Rooms that will be listened on and messages printed out to STDOUT.

## Table of Contents

- [Usage](#usage)
- [Config](#config)
- [License](#license)

## Usage

Example of usage:

```
npm start
```

Spawns a new libp2p node with new PeerId listening to TCP connections on port 6030.

```
NODE_ENV=develop npm start
```

Spawns a new libp2p node with PeerId `QmbQJ4FyVBAar7rLwc1jjeJ6Nba6w2ddqczamJL6vTDrwm` listening to websocket connections on port 8999 for WebSockets and port 8998 for TCP. If you configure a room to join, then any peers joining and leaving the room will be logged as well as any messages in th following format:

```
<roomName>: peer <peerId> joined
<roomName>: peer <peerId> left
<roomName>: message {from: <peerId>, data: <content of the message>}
<roomName>: message {from: <peerId>, data: <content of the message>, to: <peerId>} // Only for direct messages
```

## Config

In `./config`. You can switch between configurations by setting `NODE_ENV` variable. Local configuration is good to put to `local.json5` file. For configuration mechanism please visit the [node-config](https://github.com/lorenwest/node-config/) page.

```JSON5
// Libp2p config
libp2p: {},

// Peer ID in a JSON format
peerId: {},

// Rooms to subscribe to, strings
rooms: []
```

### Supported env. variables

 - `RIFC_ROOMS` (json/array): same as `rooms` option
 - `RIFC_LISTEN_ADDR` (json/array): same as `libp2p.address.listen`
 - `RIFC_COMMS_BOOTSTRAP_ENABLED` (`true`/`false`) - Defines if bootstrap should be used. Same as libp2p config's [`bootstrap.enabled`](https://github.com/libp2p/js-libp2p-bootstrap) property.
 - `RIFC_COMMS_BOOTSTRAP_LIST` (`array`) - Defines an array of multiaddress that the Pinner's libp2p node will use to bootstrap its connectivity. Same as libp2p config's [`bootstrap.list`](https://github.com/libp2p/js-libp2p-bootstrap) property.
 - `RIFC_PEER_ID` (json): Peer ID JSON like specified in [`js-peer-id](https://github.com/libp2p/js-peer-id#createfromjsonobj)

## Deployment

This project can be deployed with Dockerfile bundled with this repo. Ports 6666 and 6667 have to be published.
Also if this is deployed on production level stable PeerId should be used. If PeerId is not defined than over restarts it 
will change, which should not happen for production boot nodes. 

You can generate one using `npm run generate-peerid` and then set that either with config file or `RIFC_PEER_ID` env. variable (set the variable as the whole generated JSON).

```
$ PEER_ID=$(npm run generate-peerid) // This should be stored in some file somewhere
$ docker build -t rif-comunication-bootnode .  
$ docker run -e RIFC_PEER_ID="$PEER_ID" -p 6666 -p 6667 -it rif-comunication-bootnode  
```

## License

[MIT](./LICENSE)
