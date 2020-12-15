/* eslint no-console: 0 */
import {DirectChat, DirectMessage} from '@rsksmart/rif-communications-pubsub'
import {retry} from '@lifeomic/attempt';
import DhtService from "../service/DHTService";
import grpc from 'grpc';
import EncodingService from "../service/EncodingService";
import CommunicationsApi from "./CommunicationsApi";
import TopicService from "../service/TopicService";

class CommunicationsApiImpl implements CommunicationsApi {

    constructor(
            private peerId: any,
            private encoding: EncodingService,
            private dht: DhtService,
            private topics: TopicService,
            private directChat: DirectChat) {
        this.directChat.on('message', (directMsg: DirectMessage) => {

            console.log(directMsg);

            this.stream({
                message: directMsg,
                peerId: directMsg.from,
                signature: null
            });
        });
        this.directChat.on('error', (error: Error) => {
        });
    }

    private stream: any;

    async IsSubscribedToRskAddress({request: subscriber}: any, callback: any): Promise<void> {
        console.log("IsSubscribedToRskAddress", subscriber)
        try {
            const peerId = await this.dht.getPeerIdByRskAddress(subscriber.address);
            callback(null, {value: this.topics.isSubscribed(peerId)});
        } catch (error) {
            callback(null, {value: false});
        }
    }

    async closeTopicWithRskAddress({request: subscriber}: any, callback: any): Promise<void> {
        console.log(`closeTopic ${JSON.stringify(subscriber)} `)
        try {
            const peerId = await this.dht.getPeerIdByRskAddress(subscriber.address);
            this.topics.unsubscribe(peerId);
            callback();
        } catch (error) {
            callback({status: grpc.status.NOT_FOUND, message: error.message});
        }
    }

    async sendMessageToTopic(parameters: any, callback: any): Promise<void> {
        console.log(`sendMessageToTopic ${parameters} `)
        const status = await this.topics.publish(parameters.request.topic.channelId, parameters.request.message.payload);
        callback(status, {});
    }

    async sendMessageToRskAddress({request}: any, callback: any): Promise<void> {
        console.log(`sendMessageToRskAddress ${JSON.stringify(request)}`)
        const {receiver: {address}, message: {payload}} = request;
        const topic = await this.dht.getPeerIdByRskAddress(address);
        const status = await this.topics.publish(topic, payload);
        callback(status, {});
    }


    async updateAddress(parameters: any, callback: any): Promise<void> {
        console.log(`updateAddress ${parameters} `)
        callback(null, {});
    }


    async locatePeerId(parameters: any, callback: any): Promise<void> {
        let status: any = null;
        let response: any = {};

        try {
            console.log(`locatePeerID ${JSON.stringify(parameters.request.address)} `)
            const address = await this.dht.getPeerIdByRskAddress(parameters.request.address);
            response = {address: address};
        } catch (e) {
            status = {code: grpc.status.UNKNOWN, message: e.message}
        }


        callback(status, response);

    }

    async createTopicWithPeerId(call: any) {
        console.log(`createTopicWithPeerId ${JSON.stringify(call.request)} `);
        await this.topics.subscribe(call.request.address, call);
    }

    async createTopicWithRskAddress(call: any) {
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
            console.log(`locatePeerID ${JSON.stringify(call.request.address)} `)
            const address = await this.dht.getPeerIdByRskAddress(call.request.address);
            console.log("address", address)
            await this.topics.subscribe(address, call);
            notificationMsg.channelPeerJoined.channel.channelId = address;
            notificationMsg.channelPeerJoined.peerId = address;
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

    /*Implementation of protobuf service
        rpc ConnectToCommunicationsNode(NoParams) returns (stream Notification);
    */
    async connectToCommunicationsNode(call: any) {
        console.log("connectToCommunicationsNode", JSON.stringify(call.request))

        try {
            await retry(async (context) => {
                await this.dht.addRskAddressPeerId(call.request.address, this.peerId._idB58String)
            }, {
                delay: 1200,
                maxAttempts: 3,
            });


        } catch (err) {
            console.log(err)
        }

        let notificationMsg = {}

        if (!this.stream) {
            this.stream = call;

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
    subscribe(parameters: any, callback: any): void {
        callback();
    }

    /*Implementation of protobuf service
        rpc Publish (PublishPayload) returns (Response);
    */
    async publish(parameters: any, callback: any) {
        //TODO if there's no active stream the server should warn the user

        console.log(`publishing ${parameters.request.message.payload} in topic ${parameters.request.topic.channelId} `)
        try {
            this.topics.publish(parameters.request.topic.channelId, parameters.request.message.payload);
            callback();
        } catch (e) {
            callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: `Not subscribed to ${parameters.request.topic.channelId}`
            })
        }
    }

    async sendMessage(parameters: any, callback: any): Promise<void> {

        console.log(`sending ${parameters.request.message.payload} to ${parameters.request.to} `)

        await this.directChat.sendTo(parameters.request.to, {level: 'info', msg: parameters.request.message.payload});
        callback(null, {});
    }

    /*Implementation of protobuf service
        rpc Unsubscribe (Channel) returns (Response);
    */
    unsubscribe(parameters: any, callback: any): void {
        this.topics.unsubscribe(parameters.request.channelId)
        callback(null, {});
    }


    endCommunication(parameters: any, callback: any): void {
        if (this.stream) {
            this.stream.end();
            callback(null, {});
        } else {
            callback({
                code: grpc.status.UNKNOWN,
                message: 'There is no active connection to end'
            });
        }
    }

    getSubscribers(parameters: any, callback: any): void {
        let status: any = null;
        let response: any = {};

        if (this.topics.isSubscribed(parameters.request.channelId)) {
            const peers = this.topics.getSubscribers(parameters.request.channelId);
            response = {peerId: peers};
        } else {
            status = {
                code: grpc.status.INVALID_ARGUMENT,
                message: `Peer is not subscribed to ${parameters.request.channelId}`
            }
        }

        callback(status, response);

    }

    hasSubscriber(parameters: any, callback: any): void {
        let response: any = {};
        console.log("hasSubscriber", parameters)
        try {
            const {channelId, peerId} = parameters.request.channel;
            response = {value: this.topics.isSubscribedTo(channelId, peerId)};
        } catch (error) {
            response = {value: false};
        }
        callback(null, response);
    }


}

export default CommunicationsApiImpl;
