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

# RIF Communications bootnode

## Getting started

### Prerequisites

- Node 14+ (14.13 recommended)

### Get the code

Download the code by executing: 
```
git clone https://github.com/rsksmart/rif-communications-pubsub-bootnode -b grpc-api
```

After this, run `npm install` inside the cloned folder.


### Create a key for the RIF Communications bootnode

1. Create the `config/keys/client` folder inside the cloned directory.
2. Execute the following commands inside this new folder:

```
openssl ecparam -genkey -name secp256k1 -out ec_key.pem -param_enc explicit
``` 

And then, to generete a DER file (will require you to define a password):

```
openssl pkcs8 -in ec_key.pem -topk8 -v2 aes-256-cbc -outform DER -out ec_key_pkcs8_v2.der
``` 


### Edit the private key configuration

1. Go back to the `config` folder
2. Edit the `client.json5` file:
    1. Modify the `key.password` value to your key's password
    2. Change the `key.privateKeyURLPath` to the config key path `[...]/config/keys/client/ec_key_pkcs8_v2.der` if needed.

### Configure the Bootstrap nodes

In order to access a network, you need to connect to at least one node 
that's are already in it. You can configure these adding the the following properties in client.json5 file:

```json5
{
  libp2p: {
     ...
     config: {
       peerDiscovery: {
        bootstrap: {
          // Enable bootstrapping
           enabled: true,
          // list of nodes to connect by default
          // e.g. Lumino Network bootstrap nodes
           list: [
            "/ip4/18.214.23.85/tcp/5011/p2p/16Uiu2HAmAxP26UzDG3drx1ikopjMYK6Zseyud9qJVoshZ5RgTowJ",
            "/ip4/3.228.1.178/tcp/5011/p2p/16Uiu2HAm9Z9zSbXHHtSnjk2iCjnmBcb2ZXSA694jLCwAUUatqmGq",
            "/ip4/18.206.56.242/tcp/5011/p2p/16Uiu2HAmRzgNWzwMivPCLRvLadbmLGPrymV8rxtBeq7PhndidQ6h"
          ],
        },
      },
    },
    ...
  }
}
```
### Start the node

At the project root folder, run `NODE_ENV=client npm run api-server`

You should see a log output similar to this one:
```
[INFO] 11:34:08 ts-node-dev ver. 1.1.1 (using ts-node ver. 9.1.1, typescript ver. 4.1.3)
Loading encrypted DER key
Node started, listening on addresses:
/ip4/127.0.0.1/tcp/5011/p2p/16Uiu2HAmQswXYkmzDTgs2Em5JkhP8Y33CEhXQUHY3trctB1StTe7
/ip4/127.0.0.1/tcp/5012/ws/p2p/16Uiu2HAmQswXYkmzDTgs2Em5JkhP8Y33CEhXQUHY3trctB1StTe7

Listening on topics: 


PEERID: 16Uiu2HAmQswXYkmzDTgs2Em5JkhP8Y33CEhXQUHY3trctB1StTe7
GRPC Server started on port 5013
```

## Additional settings

### Exposing RIF Communications from a private IP address

A RIF Communications node announces its address to the network, in other to be found by other peers.
By default it announces the same IP as the one it's listening to.
This might be a problem if your node runs behind a NAT, or just if its private IP doesn't match its public one.

You can use the `addresses.announce` parameter to explicitly set the addresses you want to announce (e.g. your public address):
```json5
{
  libp2p: {
    addresses: {
      ...
      announce: [
        "/ip4/<MY PUBLIC IP ADDRESS>/tcp/<PORT>"
      ],
       ...
    },
    ...
  },
  ...
}
```
