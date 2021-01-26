import EncodingService from "./EncodingService";
import {retry} from "@lifeomic/attempt";
import ApiError from "../errors/ApiError";
import {status} from "grpc";

class DHTService {
    contentRouting;
    libp2p;
    constructor(libp2p: any,
                private encoding: EncodingService) {
        this.contentRouting = libp2p.contentRouting;
        this.libp2p = libp2p;
    }

    async addRskAddressPeerId(address: string, peerId: string): Promise<void> {
        console.log("Adding RSKADDRESS PEER=", peerId, " : RSKADDRESS=", address);
        const encodedAddress = Buffer.from(this.encoding.encode(address));
        const encodedPeerId = Buffer.from(this.encoding.encode(peerId));
        await this.contentRouting.put(encodedAddress, encodedPeerId);
    }

    async getPeerIdByRskAddress(address: string): Promise<string> {
        const encodedAddress = Buffer.from(this.encoding.encode(address));
        try {
            return await retry(async (context) => {
                    console.log(`BEFORE: ${JSON.stringify(this.libp2p._dht.datastore.data)}`)
                    const val = await this.contentRouting.get(encodedAddress);
                    console.log(`AFTER: ${JSON.stringify(this.libp2p._dht.datastore.data)}`)
                    console.log(`FINALLY: ${JSON.stringify(this.libp2p._dht.datastore.data)}`)
                    return this.encoding.decode(val)
                },
                {
                    delay: 1200,
                    maxAttempts: 3
                });
        } catch (e) {
            console.log(e);
            throw new ApiError(`Rsk address ${address} not registered`, status.NOT_FOUND);
        }
    }
}

export default DHTService;