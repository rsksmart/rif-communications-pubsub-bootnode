export class Topic {
  private readonly subscribers = new Map<string, any>();

  constructor(private id: string) {

  }

  subscribe(subscriber: string, call: any) {
    console.log(` - New subscription from ${subscriber} to ${this.id}`)
    this.subscribers.set(subscriber, call)
  }

  receive(message: any) {
    this.subscribers.forEach((stream) => stream.write(message))
  }

  unsubscribe(subscriber: string) {
    this.subscribers.delete(subscriber)
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0
  }

  hasSubscriber(subscriber: string): boolean {
    return this.subscribers.has(subscriber)
  }
}

// @ts-ignore
export default Topic
