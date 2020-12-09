import Libp2p from "libp2p";
import {IConfig} from "config";
import PeerId from "peer-id";
import {createLibP2P} from "@rsksmart/rif-communications-pubsub";
import {isValidPeerId, loadEncryptedPeerId} from "../peer-utils";


class LibP2PFactory {
    constructor() {
    }

    async fromConfig(config: IConfig): Promise<Libp2p> {
        if (config.has('key') && "" != config.get('key')) {
            return await this.fromKey(config);
        }
        //Load a peerId from cleartext peerId information
        if (config.has('peerId') && "" != config.get('peerId')) {
            return await this.fromPeerId(config);
        }
        // Create a new Peer
        //Generate using secp256k1
        return await this.fromNewPeer(config);

    }

    private async fromKey(config: IConfig): Promise<Libp2p> {
        const libp2pConfig = config.get('libp2p') as Record<string, any>
        const keyConfig = config.get('key') as Record<string, any>
        const peerId: PeerId = await loadEncryptedPeerId(new URL(keyConfig.get('privateKeyURLPath')),
            keyConfig.type, keyConfig.password, keyConfig.openSSL);

        if (!isValidPeerId(peerId)) {
            throw new Error('Supplied PeerId is not valid!')
        }

        return await createLibP2P({ ...libp2pConfig, peerId })
    }

    private async fromPeerId(config: IConfig) {
        const libp2pConfig = config.get('libp2p') as Record<string, any>
        const cnfId = config.get<{ id: string, privKey: string, pubKey: string }>('peerId')
        const peerId = await PeerId.createFromJSON(cnfId)

        if (!isValidPeerId(peerId)) {
            throw new Error('Supplied PeerId is not valid!')
        }

        return await createLibP2P({ ...libp2pConfig, peerId });
    }

    private async fromNewPeer(config: IConfig) {
        const libp2pConfig = config.get('libp2p') as Record<string, any>
        if (config.get('generatePeerWithSecp256k1Keys')) {
            const peerId = await PeerId.create({bits: 256, keyType: 'secp256k1'} as PeerId.CreateOptions);
            if (!isValidPeerId(peerId)) {
                throw new Error('Supplied PeerId is not valid!')
            }
            console.log(config.get('displayPeerId') ? peerId.toJSON() : '');
            return await createLibP2P({...libp2pConfig, peerId})
        }
        //Generate using libp2p's default (RSA 2048)
        return await createLibP2P(libp2pConfig)
    }
}

export default new LibP2PFactory();