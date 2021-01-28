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

## Getting started:

- Node 14+ (14.13 recommended)

### Get the code

Download the code by executing `git clone https://github.com/rsksmart/rif-communications-pubsub-bootnode -b grpc-api`.

After this, run `npm install` inside the cloned folder.


### Create a key for the RIF Communications bootnode

1. Create the `config/keys/sample` folder.
2. Execute the following commands inside this folder:

```
openssl ecparam -genkey -name secp256k1 -out ecs_key.pem -param_enc explicit
``` 
and then

```
openssl pkcs8 -in ec_key.pem -topk8 -v2 aes-256-cbc -v2prf hmacWithSHA256 -outform DER -out ec_key_pkcs8_v2.der
``` 
The latter one will require you to define a password.

### Create a config file

- go back to `config` folder
- edit the `sample.json5` file. Modify the `key.password` value to your key's password
- change the `key.privateKeyURLPath` to the config key path `[...]/config/keys/sample/ec_key_pkcs8_v2.der`

### Start the node

- At root folder, run `NODE_ENV=sample npm run api-server`
- You should see a log output similar to this one:

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
