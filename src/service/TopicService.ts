import Topic from '../domain/Topic'
import Libp2p from "libp2p";
import {JsonSerializable} from "@rsksmart/rif-communications-pubsub";

class TopicService {

    private readonly topics = new Map<string, Topic>();

    constructor(private libp2p: Libp2p) {
    }

    subscribe(topicId: string, call: any = null) {
        if (this.topics.has(topicId)) {
            console.log(`Already subscribed to ${topicId}`)
            throw new Error(`Already subscribed to ${topicId}`)
        }
        const topic = new Topic(topicId, this.libp2p, call);
        this.topics.set(topicId, topic);
        if (call) {
            const notificationMsg = {
                channelPeerJoined: {
                    channel: {
                        channelId: call.request.address
                    },
                    peerId: call.request.address
                }
            }
            topic.receive(notificationMsg);
        }
    }

    unsubscribe(topicId: string) {
        const topic = this.topics.get(topicId);
        topic?.unsubscribe();
        this.topics.delete(topicId);
    }

    publish(topicId: string, message: JsonSerializable) {
        if (!this.topics.has(topicId)) {
            // ERROR
        }
        this.topics.get(topicId)?.publish(message)
    }

    getSubscribers(topicId: string): any {
        return this.topics.get(topicId)?.getSubscribers();
    }

    isSubscribed(topicId: string): boolean {
        return this.topics.has(topicId);
    }


    isSubscribedTo(topicId: string, peerId: string): boolean {
        const topic = this.topics.get(topicId);
        return topic?.hasSubscriber(peerId) as boolean;
    }
}

export default TopicService;