/* eslint no-console: 0 */
import PeerId from 'peer-id'

export default async function generate (): Promise<void> {
  console.log(JSON.stringify((await PeerId.create()).toJSON()))
}

generate()
