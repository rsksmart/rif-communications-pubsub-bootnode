import Libp2p from "libp2p";
import Peer from "../domain/Peer";
import RskSubscription from "../dto/RskSubscription";
import ApiError from "../errors/ApiError";
import {status} from "grpc";

class PeerService {

    private readonly peers = new Map<string, Peer>();

    constructor(private libp2p: Libp2p) {
    }

    create(peerId: string): Peer {
        if (!this.peers.has(peerId)) {
            this.peers.set(peerId, new Peer(peerId, this.libp2p))
        }
        return this.peers.get(peerId) as Peer;
    }

    get(peerId: string): Peer | undefined {
        return this.peers?.get(peerId);
    }

    delete(peerId: string) {
        this.peers?.delete(peerId);
    }

    subscribeToTopic(peerId: string, subscription: RskSubscription, stream: any) {
        const peer = this.create(peerId);
        const topic = peer.createTopic(subscription.topic.address);
        topic?.subscribe(subscription.subscriber.address, stream)
        stream.write({
            channelPeerJoined: {
                channel: {
                    channelId: peerId
                },
                peerId: peerId
            }
        });
    }

    unsubscribeFromTopic(peerId: string, subscription: RskSubscription) {
        const peer = this.get(peerId);
        const topic = peer?.getTopic(subscription.topic.address);
        if (!topic || !topic.hasSubscriber(subscription.subscriber.address)) {
            throw new ApiError(
                `not subscribed to ${subscription.topic.address}`,
                status.FAILED_PRECONDITION
            );
        }
        topic?.unsubscribe(subscription.subscriber.address);
        if (!topic?.hasSubscribers()) {
            peer?.deleteTopic(subscription.topic.address);
        }
    }
}

export default PeerService;