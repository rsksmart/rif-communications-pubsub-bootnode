/* eslint no-console: 0 */

import config from 'config'
import { Room, createLibP2P, Message } from '@rsksmart/rif-communications-pubsub'
import PeerId from 'peer-id'
import chalk from 'chalk'
import { inspect } from 'util'
import type Libp2p from 'libp2p'

import fs from 'fs'
import KeyEncoder from 'key-encoder'
const keyEncoder: KeyEncoder = new KeyEncoder('secp256k1')
import cryptoS from 'libp2p-crypto'
const secp256k1 = require('secp256k1')


var PROTO_PATH = __dirname + '/protos/api.proto';
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var parseArgs = require('minimist');
var counter: any = 0;
let libp2p: Libp2p;

//State of the connection with the user of the GRPC API
let subscriptions = new Map();
var streamConnection: any;



// Suggested options for similarity to existing grpc.load behavior
var packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

var commsApi = protoDescriptor.communicationsapi;

//Implementation of GRPC API

/*Implementation of protobuf service
    rpc ConnectToCommunicationsNode(NoParams) returns (stream Notification);
*/
function connectToCommunicationsNode(call: any) {

    let notification = {
        type: 4,
        message: ''
    }

    if (!streamConnection) {
        streamConnection = call;
        notification.message = 'connection established';
    }
    else {
        notification.message = 'connection to server already exists';
    }

    call.write(notification);

}

/*Implementation of protobuf service
    rpc Subscribe (Channel) returns (Response);
*/
function subscribe(parameters: any, callback: any): void {
    const status: any = subscribeToRoom(parameters.request.channelId, (message: string) => {
        console.log(`${parameters.request.channelId}: WE RECEIVED\n`, message);
    });

    callback(status, {});
}

/*Implementation of protobuf service
    rpc Publish (PublishPayload) returns (Response);
*/
async function publish(parameters: any, callback: any): Promise<void> {
    //TODO if there's no active stream the server should warn the user
    const status: any = await publishToRoom(parameters.request.topic, parameters.request.message);

    callback(status, {});
}

/*Implementation of protobuf service
    rpc Unsubscribe (Channel) returns (Response);
*/
function unsubscribe(parameters: any, callback: any): void {

    let status: any = null;

    if (subscriptions.has(parameters.request.channelId)) {
        let room: Room = subscriptions.get(parameters.request.channelId);
        room.leave();
        subscriptions.delete(parameters.request.channelId);
    }
    else {
        status = {
            code: grpc.status.INVALID_ARGUMENT,
            message: `Peer was not subscribed to ${parameters.request.channelId}`
        }
    }

    callback(status, {});

}

function pingChannel(parameters: any, callback: any) {
    counter++;

    var response = {
        success: true,
        message: "PONG"
    }

    //Pong is sent as response and also through the stream, if one is open
    if (streamConnection) {

        if (counter > 10) {
            console.log("ENDING STREAM DUE TO EXCESSIVE PINGS");
            streamConnection.end();
        }
        else {
            let notification = {
                type: 4,
                message: "Pong " + counter
            }

            streamConnection.write(notification);
        }
    }

    callback(null, response);
}

function endCommunication(parameters: any, callback: any): void {

    let status: any = null

    if (streamConnection) {
        streamConnection.end();
    }
    else {
        status = {
            code: grpc.status.UNKNOWN,
            message: 'There is no active connection to end'
        }
    }
    callback(status, {});
}

function getSubscribers(parameters: any, callback: any): void {

    let status: any = null;
    let response: any = {};

    if (subscriptions.has(parameters.request.channelId)) {
        let room: Room = subscriptions.get(parameters.request.channelId);
        const peers: string[] = room.peers;
        response = { peerId: peers };
    }
    else {
        status = {
            code: grpc.status.INVALID_ARGUMENT,
            message: `Peer is not subscribed to ${parameters.request.channelId}`
        }
    }

    callback(status, response);

}

function hasSubscriber(parameters: any, callback: any): void {

    let status: any = null;
    let response: any = {};

    if (subscriptions.has(parameters.request.channel.channelId)) {
        const room: Room = subscriptions.get(parameters.request.channel.channelId);
        const hasPeer: boolean = room.hasPeer(parameters.request.peerId);

        response = { payload: hasPeer };
    }
    else {
        status = { code: grpc.status.INVALID_ARGUMENT, message: `You are not subscribed to ${parameters.request.channel.channelId}` };
    }

    callback(status, response);
}


//////////////// Internal Server Functions //////////////////////

function isValidPeerId(peerId: PeerId): boolean {
    return (
        peerId.isValid() &&
        (Buffer.isBuffer(peerId.id) || peerId.id instanceof Uint8Array) &&
        Boolean(peerId.toB58String()) &&
        Boolean(peerId.privKey) &&
        Boolean(peerId.pubKey)
    )
}

function formatMessage(msg: Message): string {
    const prefix = '    '
    const topics = `${prefix} Topics:
  ${prefix}   - ${msg.topicIDs.join(`\n${prefix} - `)}`
    const data = inspect(msg.data, undefined, 3, true).split('\n').map(line => `${prefix} ${line}`).join('\n')
    return `${prefix}${chalk.blue(`From: ${msg.from}`)}
  ${chalk.gray(topics)}
  ${data}
  `
}

function subscribeToRoom(roomName: string, messageHandler?: any): any {

    let status = null;

    if (libp2p == null) {
        status = { code: grpc.status.UNKNOWN, message: "Libp2p instance not configured" }
    }
    else if (subscriptions.has(roomName)) {
        status = { code: grpc.status.INVALID_ARGUMENT, message: `Already subscribed to ${roomName}` }
    }
    else {
        const room = new Room(libp2p, roomName)
        console.log(` - ${roomName}`)

        room.on('peer:joined', (peer) => console.log(`${roomName}: ${chalk.green(`peer ${peer} joined`)}`));
        room.on('peer:left', (peer) => console.log(`${roomName}: ${chalk.red(`peer ${peer} left`)}`));

        if (messageHandler) {
            room.on('message', (message) => messageHandler(message));
        } else {
            room.on('message', (message) => console.log(`${roomName}: message\n`, formatMessage(message)));
        }

        subscriptions.set(roomName, room);
    }
    return status;
}

async function publishToRoom(roomName: string, message: string): Promise<any> {

    let status: any = null;

    if (libp2p == null) {
        status = { code: grpc.status.UNKNOWN, message: "Libp2p instance not configured" }
    }
    else if (!subscriptions.has(roomName)) {
        status = { code: grpc.status.INVALID_ARGUMENT, message: `Not subscribed to ${roomName}` }
    }
    else {
        const room: Room = subscriptions.get(roomName);
        await room.broadcast(message);
    }

    return status;
}


const main = async () => {

    const libp2pConfig = config.get('libp2p') as Record<string, any>



    if (config.has('loadPrivKeyFromFile') && config.get('loadPrivKeyFromFile')) {
        //Import the test key file created with OpenSSL
        //Test using a secp256k1 private key imported from OpenSSL
        const privateKey: Buffer = fs.readFileSync(new URL(config.get('privateKeyURLPath')));

        //Raw key in hex
        const rawPrivKey = keyEncoder.encodePrivate(privateKey.toString(), 'pem', 'raw');
        //Convert it as buffer
        const rawPrivBuf = Buffer.from(rawPrivKey, 'hex');
        let privKeyArray = new Uint8Array(rawPrivBuf);

        //Calculate public key from the private key 
        let pubKey: Uint8Array = secp256k1.publicKeyCreate(privKeyArray)

        //Instantiate the libp2p-formatted private key
        const libp2pPrivKey = new cryptoS.keys.supportedKeys.secp256k1.Secp256k1PrivateKey(privKeyArray, pubKey);


        const peerId = await PeerId.createFromPrivKey(libp2pPrivKey.bytes);

        if (!isValidPeerId(peerId)) {
            throw new Error('Supplied PeerId is not valid!')
        }
        libp2p = await createLibP2P({ ...libp2pConfig, peerId })

    }
    else {
        if (config.has('peerId') && "" != config.get('peerId')) {
            const cnfId = config.get<{ id: string, privKey: string, pubKey: string }>('peerId')
            const peerId = await PeerId.createFromJSON(cnfId)

            if (!isValidPeerId(peerId)) {
                throw new Error('Supplied PeerId is not valid!')
            }

            libp2p = await createLibP2P({ ...libp2pConfig, peerId })
        } else {
            const generatePeer = config.get('generatePeerWithSecp256k1Keys') as boolean;
            if (generatePeer) {
                const peerId = await PeerId.create({ bits: 256, keyType: 'secp256k1' });
                if (!isValidPeerId(peerId)) {
                    throw new Error('Supplied PeerId is not valid!')
                }
                console.log(config.get('displayPeerId') ? peerId.toJSON() : '');
                libp2p = await createLibP2P({ ...libp2pConfig, peerId })
            }
            else {
                libp2p = await createLibP2P(libp2pConfig)
            }

        }
    }


    console.log('Node started, listening on addresses:')

    libp2p.multiaddrs.forEach((addr: any) => {
        console.log(`${addr.toString()}/p2p/${libp2p.peerId.toB58String()}`)
    })

    
    libp2p.on("peer:discovery", (peerId) => {
        console.log(`Found peer ${peerId.toB58String()}`);
      });
    
      // Listen for new connections to peers
      libp2p.connectionManager.on("peer:connect", (connection:any) => {
       console.log(`Connected to ${connection.remotePeer.toB58String()}`);
      });

    console.log('\nListening on topics: ')
    const rooms = config.get('rooms') as Array<string>

    rooms.forEach((roomName: string) => {
        subscribeToRoom(roomName);

    })
    console.log('\n')
}



/**
 * Get a new server with the handler functions in this file bound to the methods
 * it serves.
 * @return {Server} The new server object
 */
function getServer() {

    //Initiate communications node
    main();

    var server = new grpc.Server();
    server.addService(commsApi.CommunicationsApi.service, {
        connectToCommunicationsNode: connectToCommunicationsNode,
        pingChannel: pingChannel,
        endCommunication: endCommunication,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        publish: publish,
        getSubscribers: getSubscribers,
        hasSubscriber: hasSubscriber
    });

    return server;
}

if (require.main === module) {
    // If this is run as a script, start a server on an unused port
    var apiServer = getServer();
    const grpcPort: string = config.get('grpcPort') as string
    apiServer.bind(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure());
    var argv = parseArgs(process.argv, {
        string: 'db_path'
    });
    apiServer.start();
    console.log(`GRPC Server started on port ${grpcPort}`)

}



exports.getServer = getServer;