import { JsonSerializable, Message, Room } from '@rsksmart/rif-communications-pubsub'
import type Libp2p from 'libp2p'
import Topic from './Topic'
import { inspect } from 'util'
import chalk from 'chalk'

class Peer {
    private readonly topics = new Map<string, Topic>();
    private readonly room: Room;

    constructor (private id: string,
                private libp2p: Libp2p) {
      this.room = new Room(libp2p, id)

      this.room.on('message', (message: any) => {
        console.log(`${id}: message\n`, this.formatMessage(message))

        const channels = []
        for (let index = 0; index < message.topicIDs.length; index++) {
          const topicId: string = message.topicIDs[index]
          channels.push({ channelId: topicId })
        }

        if (message.signature != null) {
          if (message.key != null) {
            // Public key for verification
            // TODO Verify a published message before sending it might be a good practice
            // This signature is communication-implementation dependent, it's not an application-based
            // authentication (i.e, it's using the node's peerID to sign the protobuf message sent by the protocol)

          }
        }
        const payload = message.data
            this.topics.get(payload.receiver)?.receive({
              channelNewData: {
                peer: { address: message.from },
                sender: { address: payload.sender },
                data: Buffer.from(JSON.stringify(payload.content)),
                nonce: message.seqno,
                channel: channels
              }
            })
      })
    }

    createTopic (topicId: string) {
      if (!this.topics.has(topicId)) {
        this.topics.set(topicId, new Topic(topicId))
      }
      return this.topics.get(topicId)
    }

    getTopic (topicId: string): Topic | undefined {
      return this.topics.get(topicId)
    }

    deleteTopic (topicId: string) {
      this.topics.delete(topicId)
    }

    async publish (message: JsonSerializable): Promise<void> {
      await this.room.broadcast(message)
    }

    getPeers (): any[] {
      return this.room.peers
    }

    hasSubscriber (peerId: string): boolean {
      return this.room.hasPeer(peerId)
    }

    private formatMessage (msg: Message): string {
      const prefix = '    '
      const topics = `${prefix} Topics:
          ${prefix}   - ${msg.topicIDs.join(`\n${prefix} - `)}`
      const data = inspect(msg.data, undefined, 3, true).split('\n').map(line => `${prefix} ${line}`).join('\n')
      return `${prefix}${chalk.blue(`From: ${msg.from}`)}
          ${chalk.gray(topics)}
          ${data}
       `
    }
}

export default Peer
