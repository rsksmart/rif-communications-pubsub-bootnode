import EncodingService from './EncodingService'
import { retry } from '@lifeomic/attempt'

class DHTService {
  constructor (private contentRouting: any,
                private encoding: EncodingService) {}

  async addRskAddressPeerId (address: string, peerId: string) {
    console.log('Adding RSKADDRESS PEER=', peerId, ' : RSKADDRESS=', address)
    const encodedAddress = Buffer.from(this.encoding.encode(address))
    const encodedPeerId = Buffer.from(this.encoding.encode(peerId))
    await this.contentRouting.put(encodedAddress, encodedPeerId)
  }

  async getPeerIdByRskAddress (address: string): Promise<string> {
    const encodedAddress = Buffer.from(this.encoding.encode(address))
    return retry(async (context) => {
      const val = await this.contentRouting.get(encodedAddress)

      if (!val) {
        throw new Error('Value not found')
      }
      return this.encoding.decode(val)
    },
    {
      delay: 1200,
      maxAttempts: 3
    })
  }
}

export default DHTService
