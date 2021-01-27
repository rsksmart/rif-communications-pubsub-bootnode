import EncodingService from "./EncodingService";
import {retry} from "@lifeomic/attempt";
import ApiError from "../errors/ApiError";
import {status} from "grpc";

type GetData = {
    val: Uint8Array;
};

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
        const values = await this.fetchValuesByAddress(address, 1);
        if (!values.length) {
            throw new ApiError(`Rsk address ${address} not registered`, status.NOT_FOUND);
        }
        // Get first, as there is no "best" option
        const encodedPeerId = values[0];
        return this.encoding.decode(encodedPeerId);
    }

    private async fetchValuesByAddress(address: string, cant: number): Promise<Uint8Array[]> {
        try {
            const encodedAddress =  Buffer.from(this.encoding.encode(address));
            console.debug(`BEFORE: ${JSON.stringify(this.libp2p._dht.datastore.data)}`);
            const entries = (await this.libp2p._dht.getMany(encodedAddress, cant, {timeout: 30000})) as GetData[];
            console.debug(`AFTER: ${JSON.stringify(this.libp2p._dht.datastore.data)}`);
            return entries.map(entry => entry.val);
        } catch (e) {
            console.error(e);
            throw new ApiError(`Rsk address ${address} not registered`, status.NOT_FOUND);
        }
    }
}

export default DHTService;