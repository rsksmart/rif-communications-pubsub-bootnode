import Libp2p from "libp2p";
import Peer from "../domain/Peer";

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
}

export default PeerService;