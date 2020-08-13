/* eslint no-console: 0 */

import config from 'config'
import { Room, createLibP2P } from '@rsksmart/rif-communications-pubsub'
import PeerId from 'peer-id'

const isValidPeerId = (peerId: PeerId): boolean => {
  return (
    peerId.isValid() &&
      Buffer.isBuffer(peerId.id) &&
      Boolean(peerId.toB58String()) &&
      Boolean(peerId.privKey) &&
      Boolean(peerId.pubKey)
  )
}

const main = async () => {
  const cnfId = config.get('peerId') as {id: string, privKey: string, pubKey: string}
  const peerId = await PeerId.createFromJSON(cnfId)

  const cnf = config.get('libp2p') as Record<string, any>
  const libp2p = isValidPeerId(peerId) ? await createLibP2P({ ...cnf, peerId }) : await createLibP2P(cnf)

  console.log('Node started, listening on addresses:')
  libp2p.multiaddrs.forEach((addr: any) => {
    console.log(`${addr.toString()}/p2p/${libp2p.peerId.toB58String()}`)
  })

  const rooms = config.get('rooms') as Array<string>
  rooms.forEach((roomName: string) => {
    const room = new Room(libp2p, roomName)

    room.on('peer:joined', (peer) => console.log(`${roomName}: peer ${peer} joined`))
    room.on('peer:left', (peer) => console.log(`${roomName}: peer ${peer} left`))
    room.on('message', ({ from, data, to }) => console.log(`${roomName}: message ${JSON.stringify({ from, data: data?.toString(), to })}`))
  })
}

main()
