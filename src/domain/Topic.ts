import {JsonSerializable, Message, Room} from "@rsksmart/rif-communications-pubsub";
import chalk from "chalk";
import type Libp2p from "libp2p";
import {inspect} from "util";

class Topic {

    private readonly room: Room;

    constructor(private id: string,
                private libp2p: Libp2p,
                private stream: any = null) {

        this.room = new Room(this.libp2p, id)
        console.log(` - New subscription to ${id}`)
        if (this.libp2p.peerId._idB58String == id) {
            console.log("JOIN SELF")
        }

        this.room.on('message', (message: any) => {
            console.log(`${id}: message\n`, this.formatMessage(message));


            let channels = [];
            for (let index = 0; index < message.topicIDs.length; index++) {
                const topicId: string = message.topicIDs[index];
                channels.push({channelId: topicId});
            }

            if (message.signature != null) {
                if (message.key != null) {
                    //Public key for verification
                    //TODO Verify a published message before sending it might be a good practice
                    //This signature is communication-implementation dependent, it's not an application-based
                    //authentication (i.e, it's using the node's peerID to sign the protobuf message sent by the protocol)

                }
            }

            console.log("topicId", id)
            this.receive({
                channelNewData: {
                    from: message.from,
                    data: Buffer.from(JSON.stringify(message.data)),
                    nonce: message.seqno,
                    channel: channels
                }
            });
        });
    }

    receive(message: any) {
        if (this.stream) {
            this.stream.write(message);
        }
    }

    async publish(message: JsonSerializable): Promise<void> {
        await this.room.broadcast(message);
    }

    unsubscribe() {
        this.room.leave();
    }

    getSubscribers(): any[] {
        return this.room.peers;
    }

    hasSubscriber(peerId: string): boolean {
        return this.room.hasPeer(peerId);
    }

    private formatMessage(msg: Message): string {
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

export default Topic;