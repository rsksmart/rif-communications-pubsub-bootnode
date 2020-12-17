/* eslint no-console: 0 */
import config from 'config'
import {DirectChat, DirectMessage, JsonSerializable, Message, Room} from '@rsksmart/rif-communications-pubsub'
import chalk from 'chalk'
import {inspect} from 'util'
import type Libp2p from 'libp2p'
import libP2PFactory from './service/factory'
import {retry} from '@lifeomic/attempt';
import DhtService from "./service/dht";
import EncodingService from "./service/encoding";
import {JsonObject} from '@rsksmart/rif-communications-pubsub/types/definitions'

const encoder = new TextEncoder()
const decoder = new TextDecoder()


var PROTO_PATH = __dirname + '/protos/api.proto';
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var parseArgs = require('minimist');
let libp2p: Libp2p;
let encoding: EncodingService;
let dht: DhtService;

//State of the connection with the user of the GRPC API
const subscriptions = new Map<string, Room>();
var streamConnection: any;
var streamConnectionTopic = new Map();
let directChat: DirectChat;


let OK_STATUS = {
    code: grpc.status.OK,
    message: ""
}


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

    try {
        await retry(async (context) => {
            await dht.addRskAddressPeerId(call.request.address, libp2p.peerId._idB58String)
        }, {
            delay: 1200,
            maxAttempts: 3,
        });


    } catch (err) {
        console.log(err)
    }

    let notificationMsg = {}

    if (!streamConnection) {
        streamConnection = call;

        notificationMsg = {
            notification: Buffer.from('OK', 'utf8'),
            payload: Buffer.from('connection established', 'utf8')
        }
    } else {
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
    console.log("subscribe", parameters.request.channelId)
    let status: any = subscribeToRoom(parameters.request.channelId);

    callback(status, {});
}

/*Implementation of protobuf service
    rpc Publish (PublishPayload) returns (Response);
*/
async function publish(parameters: any, callback: any): Promise<void> {
    //TODO if there's no active stream the server should warn the user
    console.log(`publishing ${parameters.request.message.payload} in topic ${parameters.request.topic.channelId} `)
    const {topic, message} = parameters.request;
    const status: any = await publishToRoom(
        topic.channelId,
        {sender: libp2p.peerId.toB58String(), receiver: topic.channelId, content: message.payload}
    );

    callback(status, {});
}

async function sendMessage(parameters: any, callback: any): Promise<void> {

    console.log(`sending ${parameters.request.message.payload} to ${parameters.request.to} `)

    await directChat.sendTo(parameters.request.to, {level: 'info', msg: parameters.request.message.payload});
    callback(null, {});
}

/*Implementation of protobuf service
    rpc Unsubscribe (Channel) returns (Response);
*/
function unsubscribe(parameters: any, callback: any): void {

    let status: any = null;

    if (subscriptions.has(parameters.request.channelId)) {
        const room = subscriptions.get(parameters.request.channelId);
        room?.leave();
        subscriptions.delete(parameters.request.channelId);
    } else {
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
    } else {
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
        let room = subscriptions.get(parameters.request.channelId);
        const peers = room?.peers;
        response = {peerId: peers};
    } else {
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
    console.log("hasSubscriber", parameters)
    try {
        if (subscriptions.has(parameters.request.channel.channelId)) {
            const room = subscriptions.get(parameters.request.channel.channelId);
            const hasPeer = libp2p.peerId._idB58String === parameters.request.channel.channelId
                || room?.hasPeer(parameters.request.peerId);

            response = {value: hasPeer};
        } else {
            response = {value: false};
        }
    } catch (error) {
        response = {value: false};
    }


    callback(status, response);
}

async function IsSubscribedToRskAddress({request: subscriber}: any, callback: any): Promise<void> {
    console.log("IsSubscribedToRskAddress", subscriber)
    try {
        const peerId = await dht.getPeerIdByRskAddress(subscriber.address);
        callback(null, {value: subscriptions.has(peerId)});
    } catch (error) {
        callback(null, {value: false});
    }
}

//////////////////////LUMINO SPECIFICS///////////////////////////

async function locatePeerId(parameters: any, callback: any): Promise<void> {
    let status: any = null;
    let response: any = {};

    try {
        console.log(`locatePeerID ${JSON.stringify(parameters.request.address)} `)
        const address = await dht.getPeerIdByRskAddress(parameters.request.address);
        response = {address: address};
    } catch (e) {
        status = {code: grpc.status.UNKNOWN, message: e.message}
    }


    callback(status, response);

}

async function createTopicWithPeerId(call: any) {
    console.log(`createTopicWithPeerId ${JSON.stringify(call.request)} `)
    await subscribeToRoom(call.request.address);
    streamConnectionTopic.set(call.request.address, call);
    const notificationMsg = {
        channelPeerJoined: {
            channel: {
                channelId: call.request.address
            },
            peerId: call.request.address
        }
    }

    call.write(notificationMsg);
}

async function createTopicWithRskAddress(call: any) {
    let status: any = OK_STATUS;
    let response: any = {};
    const notificationMsg = {
        channelPeerJoined: {
            channel: {
                channelId: ""
            },
            peerId: ""
        }
    }
    console.log(`createTopicWithRskAddress ${JSON.stringify(call.request)} `)
    try {
        const rskAddress = call.request.address;
        console.log(`locatePeerID ${JSON.stringify(rskAddress)} `)
        const peerId = await dht.getPeerIdByRskAddress(rskAddress);
        console.log("address", peerId)
        await subscribeToRoom(peerId);
        if (streamConnectionTopic.has(peerId)) {
            streamConnectionTopic.get(peerId).set(rskAddress, call);
        } else {
            const rskAddresses = new Map([[rskAddress, call]])
            streamConnectionTopic.set(peerId, rskAddresses);
        }
        notificationMsg.channelPeerJoined.channel.channelId = peerId;
        notificationMsg.channelPeerJoined.peerId = peerId;

        call.write(notificationMsg);
    } catch (e) {
        const subscribeErrorMsg = {
            subscribeError: {
                channel: {
                    channelId: ""
                },
                reason: e.message
            }
        }
        console.log("ERROR", e.message)
        call.write(subscribeErrorMsg)
    }


}

async function closeTopicWithRskAddress({request: subscriber}: any, callback: any): Promise<void> {
    console.log(`closeTopic ${JSON.stringify(subscriber)} `)
    try {
        const peerId = await dht.getPeerIdByRskAddress(subscriber.address);
        if (subscriptions.has(peerId)) {
            const room = subscriptions.get(peerId);
            room?.leave();
            subscriptions.delete(peerId)
            callback();
        } else {
            callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: `Peer was not subscribed to ${subscriber.address}`
            })
        }
    } catch (error) {
        callback({status: grpc.status.NOT_FOUND, message: error.message});
    }
}

async function sendMessageToTopic(parameters: any, callback: any): Promise<void> {
    console.log(`sendMessageToTopic ${parameters} `)
    const {topic, message} = parameters.request;
    const status = await publishToRoom(topic.channelId,
        {sender: libp2p.peerId.toB58String(), receiver: topic.channelId, content: message.payload}
    )
    callback(status, {});
}

async function sendMessageToRskAddress({request}: any, callback: any): Promise<void> {
    console.log(`sendMessageToRskAddress ${JSON.stringify(request)}`)
    const {sender, receiver, message: { payload }} = request;
    const room = await dht.getPeerIdByRskAddress(receiver.address);
    const status = await publishToRoom(room, {sender: sender.address, receiver: receiver.address, content: payload});
    callback(status, {});
}


async function updateAddress(parameters: any, callback: any): Promise<void> {
    console.log(`updateAddress ${parameters} `)

    callback(null, {});
}

///////////////////////////////////


//////////////// Internal Server Functions //////////////////////


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

async function subscribeToRoom(roomName: string): Promise<any> {

    let p = new Promise((resolve, reject) => {
        let status = OK_STATUS;

        if (libp2p == null) {
            status = {code: grpc.status.UNKNOWN, message: "Libp2p instance not configured"}
            console.log('Libp2p instance not configured')
            reject(status)
        } else if (subscriptions.has(roomName)) {
            console.log(`Already subscribed to ${roomName}`)
            resolve(`Already subscribed to ${roomName}`)
        } else {
            const room = new Room(libp2p, roomName)
            console.log(` - New subscription to ${roomName}`)
            if (libp2p.peerId._idB58String == roomName) {
                console.log("JOIN SELF")
            }

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
                resolve(status);

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
                resolve(status);

            });


            room.on('message', (message) => {
                console.log(`${roomName}: message\n`, formatMessage(message));

                let channels = [];
                for (let index = 0; index < message.topicIDs.length; index++) {
                    const topicId: string = message.topicIDs[index];
                    channels.push({channelId: topicId});
                }

                if (message.signature != null) {
                    if (message.key != null) {
                        //Public key for verification
                        //TODO Verify a published message before sending it might be a good practice
                        //This signature is communication-implementation dependent, it's not an application-based
                        //authentication (i.e, it's using the node's peerID to sign the protobuf message sent by the protocol)

                    }
                }

                console.log("roomName", roomName)
                const payload = message.data as JsonObject

                streamConnectionTopic.get(roomName)?.get(payload.receiver)?.write({
                    channelNewData: {
                        peer: {address: message.from},
                        sender: {address: payload.sender},
                        data: Buffer.from(JSON.stringify(payload.content)),
                        nonce: message.seqno,
                        channel: channels
                    }
                });


                sendStreamNotification({
                    peer: {address: message.from},
                    sender: {address: payload.sender},
                    data: Buffer.from(JSON.stringify(payload.content)),
                    nonce: message.seqno,
                    channel: channels
                });
                resolve(status);
            });

            subscriptions.set(roomName, room);
            resolve(status);
        }
    });
    return p;


}

async function publishToRoom(roomName: string,
                             message: { sender: any, receiver: any, content: any }): Promise<any> {

    let status: any = null;

    if (libp2p == null) {
        status = {code: grpc.status.UNKNOWN, message: "Libp2p instance not configured"}
    } else {
        const room = new Room(libp2p, roomName)
        await room?.broadcast({ content: message});
    }

    return status;
}


const main = async () => {

    libp2p = await libP2PFactory.fromConfig(config);
    encoding = new EncodingService(encoder, decoder)
    dht = new DhtService(libp2p.contentRouting, encoding);
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
    directChat.on('error', (error: Error) => {
    })
    console.log('\n')
    console.log("PEERID:", libp2p.peerId._idB58String)
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
    const server = new grpc.Server();
    server.addService(commsApi.CommunicationsApi.service, {
        connectToCommunicationsNode: connectToCommunicationsNode,
        endCommunication: endCommunication,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        publish: publish,
        getSubscribers: getSubscribers,
        hasSubscriber: hasSubscriber,
        IsSubscribedToRskAddress: IsSubscribedToRskAddress,
        sendMessage: sendMessage,
        locatePeerId: locatePeerId,
        createTopicWithPeerId: createTopicWithPeerId,
        createTopicWithRskAddress: createTopicWithRskAddress,
        closeTopicWithRskAddress: closeTopicWithRskAddress,
        sendMessageToTopic: sendMessageToTopic,
        sendMessageToRskAddress: sendMessageToRskAddress,
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