/* eslint no-console: 0 */

import config from 'config'
import { Room, createLibP2P } from '@rsksmart/rif-communications-pubsub'
import PeerId from 'peer-id'
import type Libp2p from 'libp2p'

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
  const libp2pConfig = config.get('libp2p') as Record<string, any>

  let libp2p: Libp2p

  if (config.has('peerId')) {
    const cnfId = config.get<{ id: string, privKey: string, pubKey: string }>('peerId')
    const peerId = await PeerId.createFromJSON(cnfId)

    if (!isValidPeerId(peerId)) {
      throw new Error('Supplied PeerId is not valid!')
    }

    libp2p = await createLibP2P({ ...libp2pConfig, peerId })
  } else {
    libp2p = await createLibP2P(libp2pConfig)
  }

  console.log('Node started, listening on addresses:')
  libp2p.multiaddrs.forEach((addr: any) => {
    console.log(`${addr.toString()}/p2p/${libp2p.peerId.toB58String()}`)
  })

  const rooms = config.get('rooms') as Array<string>
  rooms.forEach((roomName: string) => {
    const room = new Room(libp2p, roomName)

    room.on('peer:joined', (peer) => console.log(`${roomName}: peer ${peer} joined`))
    room.on('peer:left', (peer) => console.log(`${roomName}: peer ${peer} left`))
    room.on('message', (message) => console.log(`${roomName}: message\n`, message))
  })
}

main()
