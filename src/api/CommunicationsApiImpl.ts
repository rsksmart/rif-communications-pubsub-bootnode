/* eslint no-console: 0 */
import {DirectChat, DirectMessage} from '@rsksmart/rif-communications-pubsub'
import {retry} from '@lifeomic/attempt';
import DhtService from "../service/DHTService";
import grpc from 'grpc';
import EncodingService from "../service/EncodingService";
import CommunicationsApi from "./CommunicationsApi";
import PeerService from "../service/PeerService";
import RskSubscription from "../dto/RskSubscription";

class CommunicationsApiImpl implements CommunicationsApi {

    constructor(
        private peerId: any,
        private encoding: EncodingService,
        private dht: DhtService,
        private peerService: PeerService,
        private directChat: DirectChat) {
    }

    async IsSubscribedToRskAddress({request: subscription}: { request: RskSubscription }, callback: any): Promise<void> {
        console.log("IsSubscribedToRskAddress", subscription)
        try {
            const peerId = await this.dht.getPeerIdByRskAddress(subscription.topic.address);
            callback(null, {
                value: this.peerService.get(peerId)
                    ?.getTopic(subscription.topic.address)
                    ?.hasSubscriber(subscription.subscriber.address)
            });
        } catch (error) {
            callback(null, {value: false});
        }
    }

    async closeTopicWithRskAddress({request: subscription}: any, callback: any): Promise<void> {
        console.log(`closeTopic ${JSON.stringify(subscription)} `)
        try {
            const {subscriber} = subscription;
            const peerId = await this.dht.getPeerIdByRskAddress(subscription.topic.address);
            const peer = this.peerService.get(peerId);
            const topic = peer?.getTopic(subscription.topic.address);
            if (!topic) {
                throw new Error("Topic not found");
            }
            topic?.unsubscribe(subscriber.address);
            if (!topic?.hasSubscribers()) {
                peer?.deleteTopic(subscription.topic.address);
            }
            callback(null, {});
        } catch (error) {
            console.log(error);
            callback({code: grpc.status.NOT_FOUND, message: `not subscribed to ${subscription.topic.address}` });
        }
    }

    async sendMessageToTopic(parameters: any, callback: any): Promise<void> {
        console.log(`sendMessageToTopic ${parameters} `)
        const peer = this.peerService.create(parameters.request.topic.channelId);

        peer.publish({content: parameters.request.message.payload});
        callback(status, {});
    }

    async sendMessageToRskAddress({request}: any, callback: any): Promise<void> {
        console.log(`sendMessageToRskAddress ${JSON.stringify(request)}`)
        try {
            const {
                receiver: {address: receiverAddress},
                sender: {address: senderAddress},
                message: {payload}
            } = request;
            const peerId = await this.dht.getPeerIdByRskAddress(receiverAddress);
            const peer = this.peerService.create(peerId);
            await peer.publish({content: payload, receiver: receiverAddress, sender: senderAddress});
            callback(null, {});
        } catch (e) {
            callback({code: grpc.status.NOT_FOUND, message: "not found"}, {});
        }

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
            status = {code: grpc.status.NOT_FOUND, message: "not found"}
        }


        callback(status, response);

    }

    async createTopicWithPeerId(call: any) {
        try {
            console.log(`createTopicWithPeerId ${JSON.stringify(call.request)} `);
            const peer = this.peerService.create(call.request.topic.address);
            const topic = peer.createTopic(call.request.topic.address);
            topic?.subscribe(call.request.subscriber.address, call)
        } catch (e) {
            call.write({
                subscribeError: {
                    channel: {
                        channelId: ""
                    },
                    reason: e.message
                }
            });
        }
    }

    async createTopicWithRskAddress(call: any) {
        console.log(`createTopicWithRskAddress ${JSON.stringify(call.request)} `)
        try {
            const peerId = await this.dht.getPeerIdByRskAddress(call.request.topic.address);
            const peer = this.peerService.create(peerId);
            const topic = peer.createTopic(call.request.topic.address);
            topic?.subscribe(call.request.subscriber.address, call)
            call.write({
                channelPeerJoined: {
                    channel: {
                        channelId: peerId
                    },
                    peerId: peerId
                }
            });
        } catch (e) {
            call.write({
                subscribeError: {
                    reason: `Address ${call.request.topic.address} not found`
                }
            })
        }
    }

    /*Implementation of protobuf service
        rpc ConnectToCommunicationsNode(NoParams) returns (stream Notification);
    */
    async connectToCommunicationsNode(parameters: any, callback: any) {
        console.log("connectToCommunicationsNode", JSON.stringify(parameters.request))

        try {
            await retry(async (context) => {
                await this.dht.addRskAddressPeerId(parameters.request.address, this.peerId._idB58String)
            }, {
                delay: 1200,
                maxAttempts: 3,
            });
            callback(null, {
                notification: Buffer.from('OK', 'utf8'),
                payload: Buffer.from('connection established', 'utf8')
            });
        } catch (error) {
            console.log(error);
            callback({code: grpc.status.NOT_FOUND, message: `not found ${parameters.request.address}`});
        }
    }

    /*Implementation of protobuf service
        rpc Subscribe (Channel) returns (Response);
    */

    //TODO the function must write to the stream not to a console log
    subscribe(parameters: any, callback: any): void {
        callback(null, {});
    }

    /*Implementation of protobuf service
        rpc Publish (PublishPayload) returns (Response);
    */
    async publish(parameters: any, callback: any) {
        //TODO if there's no active stream the server should warn the user
        console.log(`publishing ${parameters.request.message.payload} in topic ${parameters.request.topic.channelId} `)
        const peer = this.peerService.create(parameters.request.topic.channelId);
        peer.publish({content: parameters.request.message.payload});
        callback(null,{});
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
        this.peerService.get(parameters.request.channelId)?.deleteTopic(parameters.request.channelId);
        callback(null, {});
    }


    endCommunication(parameters: any, callback: any): void {
    }

    getSubscribers(parameters: any, callback: any): void {
        let status: any = null;
        let response: any = {};
        const peer = this.peerService.get(parameters.request.channelId);
        if (peer) {
            const peers = peer.getPeers();
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
            response = {value: this.peerService.get(channelId)?.getPeers()?.length};
        } catch (error) {
            response = {value: false};
        }
        callback(null, response);
    }


}

export default CommunicationsApiImpl;
