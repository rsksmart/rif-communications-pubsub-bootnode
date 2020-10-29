/* eslint no-console: 0 */
import config from 'config'
import { Room, createLibP2P, Message, DirectChat, DirectMessage } from '@rsksmart/rif-communications-pubsub'
import PeerId from 'peer-id'
import chalk from 'chalk'
import { inspect } from 'util'
import type Libp2p from 'libp2p'

import fs from 'fs'
import KeyEncoder from 'key-encoder'
const keyEncoder: KeyEncoder = new KeyEncoder('secp256k1')
import cryptoS from 'libp2p-crypto'
import { decryptPrivateKey, decryptDERPrivateKey } from './crypto'
const secp256k1 = require('secp256k1')
const encoder = new TextEncoder()
const decoder = new TextDecoder()


var PROTO_PATH = __dirname + '/protos/api.proto';
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var parseArgs = require('minimist');
let libp2p: Libp2p;

//State of the connection with the user of the GRPC API
let subscriptions = new Map();
var streamConnection: any;
var streamConnectionTopic = new Map(); //REPLACE WITH KEY/VALUE for each channelTopic
let directChat: DirectChat;



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
async function connectToCommunicationsNode(call: any) {

    console.log("connectToCommunicationsNode", JSON.stringify(call.request))
    const key = Buffer.from(encoder.encode("RSK:"+call.request.address));
    const value = Buffer.from(encoder.encode(libp2p.peerId._idB58String));
    try{
       console.log("Adding RSKADDRESS PEER=",libp2p.peerId._idB58String, " : RSKADDRESS=",call.request.address);
        await libp2p.contentRouting.put(key, value);
    }
    catch{

    }
    

    let notificationMsg = {
    }

    if (!streamConnection) {
        streamConnection = call;

        notificationMsg = {
            notification: Buffer.from('OK', 'utf8'),
            payload: Buffer.from('connection established', 'utf8')
        }
    }
    else {
        notificationMsg = {
            notification: Buffer.from('ERROR', 'utf8'),
            payload: Buffer.from('connection to server already exists', 'utf8')
        }
    }

    call.write(notificationMsg);
}

/*Implementation of protobuf service
    rpc Subscribe (Channel) returns (Response);
*/
//TODO the function must write to the stream not to a console log
function subscribe(parameters: any, callback: any): void {
    let status: any = subscribeToRoom(parameters.request.channelId);

    callback(status, {});
}

/*Implementation of protobuf service
    rpc Publish (PublishPayload) returns (Response);
*/
async function publish(parameters: any, callback: any): Promise<void> {
    //TODO if there's no active stream the server should warn the user

    console.log(`publishing ${parameters.request.message.payload} in topic ${parameters.request.topic.channelId} `)
    const status: any = await publishToRoom(parameters.request.topic.channelId, parameters.request.message.payload);

    callback(status, {});
}

async function sendMessage(parameters: any, callback: any): Promise<void> {

    console.log(`sending ${parameters.request.message.payload} to ${parameters.request.to} `)

    await directChat.sendTo(parameters.request.to, { level: 'info', msg: parameters.request.message.payload });
    callback(null, {});
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

        response = { value: hasPeer };
    }
    else {
        status = { code: grpc.status.INVALID_ARGUMENT, message: `You are not subscribed to ${parameters.request.channel.channelId}` };
    }

    callback(status, response);
}

//////////////////////LUMINO SPECIFICS///////////////////////////

async function locatePeerId (parameters: any, callback: any): Promise<void> {
    let status: any = null;
    let response: any = {};

    try {
        console.log(`locatePeerID ${JSON.stringify(parameters.request.address)} `)
        const key = Buffer.from(encoder.encode("RSK:"+parameters.request.address));
        const address = await getKey(key);
        response = { address: address };
    }
    catch(e) {
        status = { code: grpc.status.UNKNOWN, message: e.message }
    }

    

    callback(status, response);

}

async function createTopicWithPeerId(call: any) {
    console.log(`createTopicWithPeerId ${JSON.stringify(call.request)} `)
    //REFACTOR CODE
    const status = subscribeToRoom(call.request.address);
    streamConnectionTopic.set(call.request.address,call);
    console.log("STATUS",status);
    //const status: any = await publishToRoom(parameters.request.topic.channelId, parameters.request.message.payload);    

    call.write(status, {});
}

async function createTopicWithRskAddress (call: any) {
    let status: any = null;
    let response: any = {};
    console.log(`createTopicWithRskAddress ${JSON.stringify(call.request)} `)
    try {
        console.log(`locatePeerID ${JSON.stringify(call.request.address)} `)
        //REFACTOR CODE
        const key = Buffer.from(encoder.encode("RSK:"+call.request.address));
        const address = await getKey(key);
        console.log("address",decoder.decode(address))
        status = subscribeToRoom(decoder.decode(address));
        streamConnectionTopic.set(decoder.decode(address),call); //REPLACE WITH KEY/VALUE INSTEAD OF HARDCODED VALUE
        response = { address: address };
    }
    catch(e) {
        status = { code: grpc.status.UNKNOWN, message: e.message }
    }

    call.write(status, {});
}

async function closeTopic(parameters: any, callback: any): Promise<void> {
    console.log(`closeTopic ${parameters} `)
    //callback(unsubscribe(parameters,callback));

    callback(null, {});
}

async function sendMessageToTopic(parameters: any, callback: any): Promise<void> {
    console.log(`sendMessageToTopic ${parameters} `)
    const status: any = await publishToRoom(parameters.request.topic.channelId, parameters.request.message.payload);

    callback(status, {});
}

async function updateAddress (parameters: any, callback: any): Promise<void> {
    console.log(`updateAddress ${parameters} `)

    callback(null, {});
}
///////////////////////////////////


//////////////// Internal Server Functions //////////////////////

async function getKey(key: any): Promise<any> {
    const value = await libp2p.contentRouting.get(key);
    console.log(value.toString())
    return value
}

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

function sendStreamNotification(message: any) {
    if (streamConnection) {
        streamConnection.write(message);
    }
}

function subscribeToRoom(roomName: string): any {

    let status = null;

    if (libp2p == null) {
        status = { code: grpc.status.UNKNOWN, message: "Libp2p instance not configured" }
        console.log('Libp2p instance not configured')
    }
    else if (subscriptions.has(roomName)) {
        console.log('already subscribed')
        status = { code: grpc.status.INVALID_ARGUMENT, message: `Already subscribed to ${roomName}` }
    }
    else {
        const room = new Room(libp2p, roomName)
        console.log(` - New subscription to ${roomName}`)

        room.on('peer:joined', (peer) => {
            console.log(`${roomName}: ${chalk.green(`peer ${peer} joined`)}`);
            sendStreamNotification({
                channelPeerJoined: {
                    channel: {
                        channelId: roomName
                    },
                    peerId: peer
                }
            });

        });

        room.on('peer:left', (peer) => {
            console.log(`${roomName}: ${chalk.red(`peer ${peer} left`)}`);
            sendStreamNotification({
                channelPeerLeft: {
                    channel: {
                        channelId: roomName
                    },
                    peerId: peer
                }
            });

        });


        room.on('message', (message) => {
            console.log(`${roomName}: message\n`, formatMessage(message));


            let channels = [];
            for (let index = 0; index < message.topicIDs.length; index++) {
                const topicId: string = message.topicIDs[index];
                channels.push({ channelId: topicId });
            }

            if (message.signature != null) {
                if (message.key != null) {
                    //Public key for verification
                    //TODO Verify a published message before sending it might be a good practice
                    //This signature is communication-implementation dependent, it's not an application-based
                    //authentication (i.e, it's using the node's peerID to sign the protobuf message sent by the protocol)

                }
            }
            //TODO REPLACE FOR KEY/VALUE OF TOPICS INSTEAD OF HARDCDODE VARIABLE
            streamConnectionTopic.get(roomName).write({
                channelNewData: {
                    from: message.from,
                    data: Buffer.from(JSON.stringify(message.data)),
                    nonce: message.seqno,
                    channel: channels
                }
            });

            sendStreamNotification({
                channelNewData: {
                    from: message.from,
                    data: Buffer.from(JSON.stringify(message.data)),
                    nonce: message.seqno,
                    channel: channels
                }
            });
        });


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


function loadEncryptedPeerId(keyFile: URL, keyType: string, password: string, isOpenSSL: boolean): Promise<PeerId> {
    //Import the test key file created with OpenSSL
    //Test using a secp256k1 private key imported from OpenSSL
    const privateKey: Buffer = fs.readFileSync(keyFile);
    let privKeyArray = null;

    if (keyType == "PEM") {
        if (password == "") { //unencrypted
            privKeyArray = new Uint8Array(Buffer.from(keyEncoder.encodePrivate(privateKey.toString(), 'pem', 'raw'), 'hex'));
        }
        else {
            if (isOpenSSL) {
                throw new Error('OpenSSL encrypted keys must be in DER');
            }
            else {
                privKeyArray = new Uint8Array(decryptPrivateKey(privateKey.toString(), password));
            }
        }
    }
    else {
        //DER
        if (password == "") { //not encrypted
            privKeyArray = new Uint8Array(Buffer.from(keyEncoder.encodePrivate(privateKey.toString(), 'der', 'raw'), 'hex'));
        }
        else {
            console.log("Loading encrypted DER key");
            privKeyArray = new Uint8Array(decryptDERPrivateKey(privateKey, password));
        }
    }


    //Calculate public key from the private key 
    let pubKey: Uint8Array = secp256k1.publicKeyCreate(privKeyArray)

    //Instantiate the libp2p-formatted private key
    const libp2pPrivKey = new cryptoS.keys.supportedKeys.secp256k1.Secp256k1PrivateKey(privKeyArray, pubKey);


    return PeerId.createFromPrivKey(libp2pPrivKey.bytes);
}

const main = async () => {

    const libp2pConfig = config.get('libp2p') as Record<string, any>


    const keyConfig = config.get('key') as Record<string, any>

    //Load a peerId from an encrypted private key
    if (config.has('key') && "" != config.get('key')) {

        const peerId: PeerId = await loadEncryptedPeerId(new URL(keyConfig.get('privateKeyURLPath')),
            keyConfig.type, keyConfig.password, keyConfig.openSSL);

        if (!isValidPeerId(peerId)) {
            throw new Error('Supplied PeerId is not valid!')
        }

        libp2p = await createLibP2P({ ...libp2pConfig, peerId })

    }
    //Load a peerId from cleartext peerId information
    else if (config.has('peerId') && "" != config.get('peerId')) {
        const cnfId = config.get<{ id: string, privKey: string, pubKey: string }>('peerId')
        const peerId = await PeerId.createFromJSON(cnfId)

        if (!isValidPeerId(peerId)) {
            throw new Error('Supplied PeerId is not valid!')
        }

        libp2p = await createLibP2P({ ...libp2pConfig, peerId })
    }
    // Create a new Peer
    else {

        const generatePeer = config.get('generatePeerWithSecp256k1Keys') as boolean;

        //Generate using secp256k1 
        if (generatePeer) {
            const peerId = await PeerId.create({ bits: 256, keyType: 'secp256k1' });
            if (!isValidPeerId(peerId)) {
                throw new Error('Supplied PeerId is not valid!')
            }
            console.log(config.get('displayPeerId') ? peerId.toJSON() : '');
            libp2p = await createLibP2P({ ...libp2pConfig, peerId })
        }
        //Generate using libp2p's default (RSA 2048)
        else {
            libp2p = await createLibP2P(libp2pConfig)
        }

    }

    console.log('Node started, listening on addresses:')

    libp2p.multiaddrs.forEach((addr: any) => {
        console.log(`${addr.toString()}/p2p/${libp2p.peerId.toB58String()}`)
    })


    libp2p.on("peer:discovery", (peerId) => {
        console.log(`Found peer ${peerId.toB58String()}`);
    });
    const key = Buffer.from(encoder.encode('KEY'));
    const value = Buffer.from(encoder.encode('RSKADDRESS 0'));

    // Listen for new connections to peers
    libp2p.connectionManager.on("peer:connect", async (connection: any) => {
        console.log(`Connected to ${connection.remotePeer.toB58String()}`);
        //const test = await getKey(key);
        //console.log(test);
    });


    console.log('\nListening on topics: ')
    const rooms = config.get('rooms') as Array<string>

    rooms.forEach((roomName: string) => {
        subscribeToRoom(roomName);
    })

    directChat = DirectChat.getDirectChat(libp2p);
    directChat.on('message', (directMsg: DirectMessage) => {

        console.log(directMsg);

        sendStreamNotification({
            message: directMsg,
            peerId: directMsg.from,
            signature: null
        });
    })
    directChat.on('error', (error: Error) => { })
    console.log('\n')

    //const key = encoder.encode('K')
    //const value = encoder.encode('V')
    //console.log(key, value);
    //console.log(libp2p)



    console.log("PEERID:", libp2p.peerId._idB58String)
    /*if (libp2p.peerId._idB58String === "16Uiu2HAmJgg1YDeeNKxY2PJ11LCWx56spjfEJdhvD5HvSCjyszaX") {
        console.log("WRITING VALUE")
        await libp2p.contentRouting.put(key, value);
    }*/


    //console.log(libp2p._dht.contentRouting)





}



/**
 * Get a new server with the handler functions in this file bound to the methods
 * it serves.
 * @return {Server} The new server object
 */
function getServer() {

    //Initiate communications node
    main();

    //console.log(commsApi);
    var server = new grpc.Server();
    server.addService(commsApi.CommunicationsApi.service, {
        connectToCommunicationsNode: connectToCommunicationsNode,
        endCommunication: endCommunication,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        publish: publish,
        getSubscribers: getSubscribers,
        hasSubscriber: hasSubscriber,
        sendMessage: sendMessage,
        locatePeerId: locatePeerId,
        createTopicWithPeerId: createTopicWithPeerId,
        createTopicWithRskAddress: createTopicWithRskAddress,
        closeTopic: closeTopic, 
        sendMessageToTopic: sendMessageToTopic,
        updateAddress: updateAddress,
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