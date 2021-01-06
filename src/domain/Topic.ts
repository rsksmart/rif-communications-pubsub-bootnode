import {JsonSerializable, Message, Room} from "@rsksmart/rif-communications-pubsub";
import chalk from "chalk";
import type Libp2p from "libp2p";
import {inspect} from "util";

class Topic {

    private readonly subscribers = new Map<string, any>();

    constructor(private id: string) {

    }

    subscribe(subscriber: string, stream: any) {
        console.log(` - New subscription from ${subscriber} to ${this.id}`)
        this.subscribers.set(subscriber, stream);
    }

    receive(message: any) {
        this.subscribers.forEach((stream) => stream.write(message));
    }

    unsubscribe(subscriber: string) {
        this.subscribers.delete(subscriber);
    }


    hasSubscribers(): boolean {
        return this.subscribers.size > 0;
    }

    hasSubscriber(subscriber: string): boolean {
        return this.subscribers.has(subscriber);
    }
}

export default Topic;