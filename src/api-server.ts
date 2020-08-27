/* eslint no-console: 0 */

import config from 'config'
import { Room, createLibP2P, Message } from '@rsksmart/rif-communications-pubsub'
import PeerId from 'peer-id'
import chalk from 'chalk'
import { inspect } from 'util'
import type Libp2p from 'libp2p'

function isValidPeerId(peerId: PeerId): boolean {
    return (
        peerId.isValid() &&
        Buffer.isBuffer(peerId.id) &&
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

    console.log("connectToCommunicationsNode called");

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
    console.log("SUBSCRIPTION");
    const subscribed = subscribeToRoom(parameters.request.channelId, (message:string)=>{
        console.log(`${parameters.request.channelId}: WE RECEIVED\n`, message);
    });
    let msg = `subscribed to ${parameters.request.channelId}`;

    if (!subscribed) {
        msg == (subscriptions.has(parameters.request.channelId) ? 'already subscribed' : 'unknown error');
    }

    let response = {
        success: subscribed,
        message: msg
    }
    callback(null, response);
}

/*Implementation of protobuf service
    rpc Publish (PublishPayload) returns (Response);
*/
function publish(parameters: any, callback: any): void {
    console.log("LALLALA");
    //TODO if there's no active stream the server should warn the user
    console.log( `PUBLISHING TO ROOM  ${parameters.request.topic} the message "${parameters.request.message}"`)
    const published: boolean = publishToRoom(parameters.request.topic, parameters.request.message);
    let response = {
        success: published,
        message: ''
    }
    callback(null, response);

}

function pingChannel(noparam: any, callback: any) {
    console.log("PING WAS CALLED");
    counter++;

    var response = {
        success: true,
        message: "OK"
    }

    if (streamConnection) {

        if (counter > 10) {
            console.log("ENDING CONNECTION");
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

function endCommunication() {
    if (streamConnection)
        streamConnection.end();
}




function subscribeToRoom(roomName: string, messageHandler?: any): boolean {
    let subscribed = false;//Aleady subscribed counts as "no subscription made"
    if (libp2p != null && !subscriptions.has(roomName)) {
        const room = new Room(libp2p, roomName)
        console.log(` - ${roomName}`)

        room.on('peer:joined', (peer) => console.log(`${roomName}: ${chalk.green(`peer ${peer} joined`)}`));
        room.on('peer:left', (peer) => console.log(`${roomName}: ${chalk.red(`peer ${peer} left`)}`));
        room.on('message', (message) => console.log(`${roomName}: message\n`, formatMessage(message)));

        if (messageHandler) {
            room.on('message', (message) => messageHandler(message));
        }

        subscriptions.set(roomName, room);
        subscribed = true;
    }
    return subscribed;
}

function publishToRoom(roomName: string, message: string): boolean {
    let published = false;
    if (libp2p != null && subscriptions.has(roomName)) {
        const room: Room = subscriptions.get(roomName);

        room.broadcast(message);
        published = true;
    }
    return published;
}

const main = async () => {

    const libp2pConfig = config.get('libp2p') as Record<string, any>


    if (config.has('peerId')) {
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
            console.log(config.get('displayPeerId') ? peerId.toJSON() : '');
            libp2p = await createLibP2P({ ...libp2pConfig, peerId })
        }
        else {
            libp2p = await createLibP2P(libp2pConfig)
        }
    }

    console.log('Node started, listening on addresses:')
    libp2p.multiaddrs.forEach((addr: any) => {
        console.log(`${addr.toString()}/p2p/${libp2p.peerId.toB58String()}`)
    })

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
        publish: publish
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