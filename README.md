# RIF Communications PubSub node

[![CircleCI](https://flat.badgen.net/circleci/github/rsksmart/rif-communications-pubsub-node/master)](https://circleci.com/gh/rsksmart/rif-communications-pubsub-node/)
[![Dependency Status](https://david-dm.org/rsksmart/rif-communications-pubsub-node.svg?style=flat-square)](https://david-dm.org/rsksmart/rif-communications-pubsub-node)
[![](https://img.shields.io/badge/made%20by-IOVLabs-blue.svg?style=flat-square)](http://iovlabs.org)
[![](https://img.shields.io/badge/project-RIF%20Storage-blue.svg?style=flat-square)](https://www.rifos.org/)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
[![Managed by tAsEgir](https://img.shields.io/badge/%20managed%20by-tasegir-brightgreen?style=flat-square)](https://github.com/auhau/tasegir)
![](https://img.shields.io/badge/npm-%3E%3D6.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D10.0.0-orange.svg?style=flat-square)

> Simple base node for RIF Communications PubSub

This is a utility repo to be used by developers. The aim to provide a local libp2p node which serves as bootstrap node for projects which use [`rif-commmunications-pubsub`](https://github.com/rsksmart/rif-communications-pubsub)

## Table of Contents

- [Usage](#usage)
- [Config](#config)
- [License](#license)

## Usage

Example of usage:

```
npm run exec
```

Spawns a new libp2p node with new PeerId listening to TCP connections on system allocated port.

```
NODE_ENV=develop npm run exec
```

Spawns a new libp2p node with PeerId `QmbQJ4FyVBAar7rLwc1jjeJ6Nba6w2ddqczamJL6vTDrwm` listening to websocket connections on system allocated port and joins rooms `0xtestroom` and `0xtestroom2`. Any peers joining and leaving the room will be logged as well as any messages in th following format:

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

## License

[MIT](./LICENSE)
