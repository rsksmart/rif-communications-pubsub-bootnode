/* eslint no-console: 0 */
import config from 'config'
import { DirectChat } from '@rsksmart/rif-communications-pubsub'

import { authorizationHandler, createChallengeHandler } from './api/auth/handler'
import { secureAPI } from './api/auth/utils'
import libP2PFactory from './service/LibP2PFactory'
import DhtService from './service/DHTService'
import EncodingService from './service/EncodingService'
import CommunicationsApiImpl from './api/CommunicationsApiImpl'
import CommunicationsApi from './api/CommunicationsApi'
import PeerService from './service/PeerService'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const PROTO_PATH = __dirname + '/protos/api.proto'
const grpc = require('grpc')
const protoLoader = require('@grpc/proto-loader')
const parseArgs = require('minimist')

// Suggested options for similarity to existing grpc.load behavior
const packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)

const commsApi = protoDescriptor.communicationsapi

async function getApi (): Promise<CommunicationsApi> {
  const libp2p = await libP2PFactory.fromConfig(config)
  const encoding = new EncodingService(encoder, decoder)
  const dht = new DhtService(libp2p.contentRouting, encoding)
  const peerService = new PeerService(libp2p)
  const rooms = config.get('rooms') as Array<string>
  const directChat = DirectChat.getDirectChat(libp2p)

  const api = new CommunicationsApiImpl(
    libp2p.peerId,
    encoding,
    dht,
    peerService,
    directChat)
  console.log('Node started, listening on addresses:')

  libp2p.multiaddrs.forEach((addr: any) => {
    console.log(`${addr.toString()}/p2p/${libp2p.peerId.toB58String()}`)
  })

  libp2p.on('peer:discovery', (peerId) => {
    console.log(`Found peer ${peerId.toB58String()}`)
  })
  const key = Buffer.from(encoder.encode('KEY'))
  const value = Buffer.from(encoder.encode('RSKADDRESS 0'))

  // Listen for new connections to peers
  libp2p.connectionManager.on('peer:connect', async (connection: any) => {
    console.log(`Connected to ${connection.remotePeer.toB58String()}`)
    // const test = await getKey(key);
    // console.log(test);
  })

  console.log('\nListening on topics: ')

  rooms.forEach((roomName: string) => {
    const peer = peerService.create(roomName)
    const topic = peer.createTopic(roomName)
  })

  console.log('\n')
  console.log('PEERID:', libp2p.peerId._idB58String)
  return api
}

/**
 * Get a new server with the handler functions in this file bound to the methods
 * it serves.
 * @return {Server} The new server object
 */
async function getServer () {
  const apiService = await getApi()
  const server = new grpc.Server()
  const API = {
    connectToCommunicationsNode: apiService.connectToCommunicationsNode.bind(apiService),
    endCommunication: apiService.endCommunication.bind(apiService),
    subscribe: apiService.subscribe.bind(apiService),
    unsubscribe: apiService.unsubscribe.bind(apiService),
    publish: apiService.publish.bind(apiService),
    getSubscribers: apiService.getSubscribers.bind(apiService),
    hasSubscriber: apiService.hasSubscriber.bind(apiService),
    IsSubscribedToRskAddress: apiService.IsSubscribedToRskAddress.bind(apiService),
    sendMessage: apiService.sendMessage.bind(apiService),
    locatePeerId: apiService.locatePeerId.bind(apiService),
    createTopicWithPeerId: apiService.createTopicWithPeerId.bind(apiService),
    createTopicWithRskAddress: apiService.createTopicWithRskAddress.bind(apiService),
    closeTopicWithRskAddress: apiService.closeTopicWithRskAddress.bind(apiService),
    sendMessageToTopic: apiService.sendMessageToTopic.bind(apiService),
    sendMessageToRskAddress: apiService.sendMessageToRskAddress.bind(apiService),
    updateAddress: apiService.updateAddress.bind(apiService),
    createChallenge: createChallengeHandler,
    auth: authorizationHandler
  }

  server.addService(commsApi.CommunicationsApi.service, secureAPI(API))
  return server
}

export async function main () {
  // If this is run as a script, start a server on an unused port
  const apiServer = await getServer()
  const grpcPort: string = config.get('grpcPort') as string
  apiServer.bind(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure())
  const argv = parseArgs(process.argv, {
    string: 'db_path'
  })
  apiServer.start()
  console.log(`GRPC Server started on port ${grpcPort}`)
  return apiServer
}

if (require.main === module) {
  main()
}

exports.getServer = getServer
