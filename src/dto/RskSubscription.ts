import type { RskAddress } from './RskAddress'

export default interface RskSubscription {
    subscriber: RskAddress
    topic: RskAddress
}
