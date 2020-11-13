#!/usr/bin/env node
/* eslint no-console: 0 */

import config from 'config'
import { Room, createLibP2P, Message } from '@rsksmart/rif-communications-pubsub'
import PeerId from 'peer-id'
import chalk from 'chalk'
import { inspect } from 'util'

import type Libp2p from 'libp2p'

function isValidPeerId (peerId: PeerId): boolean {
  return (
    peerId.isValid() &&
    Boolean(peerId.toB58String()) &&
    Boolean(peerId.privKey) &&
    Boolean(peerId.pubKey)
  )
}

function formatMessage (msg: Message): string {
  const prefix = '    '
  const topics = `${prefix} Topics:
${prefix}   - ${msg.topicIDs.join(`\n${prefix} - `)}`
  const data = inspect(msg.data, undefined, 3, true).split('\n').map(line => `${prefix} ${line}`).join('\n')
  return `${prefix}${chalk.blue(`From: ${msg.from}`)}
${chalk.gray(topics)}
${data}
`
}

export default async function main () {
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
  console.log('\nListening on topics: ')

  rooms.forEach((roomName: string) => {
    const room = new Room(libp2p, roomName)
    console.log(` - ${roomName}`)

    room.on('peer:joined', (peer) => console.log(`${roomName}: ${chalk.green(`peer ${peer} joined`)}`))
    room.on('peer:left', (peer) => console.log(`${roomName}: ${chalk.red(`peer ${peer} left`)}`))
    room.on('message', (message) => console.log(`${roomName}: message\n`, formatMessage(message)))
  })
  console.log('\n')
}

main()
