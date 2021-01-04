import config from 'config'
import chai from 'chai'
import jwt from 'jsonwebtoken'
import sinonChai from 'sinon-chai'
import grpc from 'grpc'
import { Wallet } from 'ethers'

import { getGRPCClient, hexToBuffer, promisifyCall, sleep } from '../utils'
import { main as startServer } from '../../src/api-server'

chai.use(sinonChai)
const expect = chai.expect

describe('Auth for gRPC', function() {
  this.timeout(6000)

  let client: any
  let server: any

  const TEST_PRIV_KEY = '0x0123456789012345678901234567890123456789012345678901234567890123'
  const TEST_WALLET = new Wallet(TEST_PRIV_KEY)
  const TEST_ADDRESS = TEST_WALLET.address

  before(async () => {
    server = await startServer()
    client = getGRPCClient(`localhost:${config.get('grpcPort')}`)
    console.log(`Client created for localhost:${config.get('grpcPort')}`)
  })
  after(() => {
    server.forceShutdown()
  })

  it('should return error when accessing secure route without auth', async () => {
    try {
      await promisifyCall((callback: any) => client.connectToCommunicationsNode({ address: TEST_ADDRESS }, callback))
    } catch (e) {
      expect(e.code).to.be.eql(grpc.status.UNAUTHENTICATED)
      expect(e.details).to.be.eql('Not authorized')
    }
  })
  it('should return error when accessing secure ASYNC route without auth', async () => {
    await new Promise((resolve, reject) => {
      const call = client.CreateTopicWithPeerId({ address: 'someSortOFADdress' })
      call.on('data', (data: any, err: any) => {})
      call.on('error', (error: any) => {
        expect(error.code).to.be.eql(grpc.status.UNAUTHENTICATED)
        expect(error.details).to.be.eql('Not authorized')
        resolve()
      })
    })
  })
  it('should be able to call secure API after success auth', async () => {
    // Retrieve challenge for address
    const { challenge } = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
    // Sign challenge
    const signature = hexToBuffer(await TEST_WALLET.signMessage(challenge))
    // Send signature to auth API
    const { token } = await promisifyCall((callback: any) => client.auth({ address: TEST_ADDRESS, signature }, callback))

    // Call secure API
    const meta = new grpc.Metadata()
    meta.set('authorization', 'Bearer ' + token)
    await promisifyCall((callback: any) => client.ConnectToCommunicationsNode({ address: TEST_ADDRESS }, meta, callback))
  })
  it('JWT token should expire after exp time', async () => {
    // @ts-ignore
    config.authorization.expiresIn = '3s'

    // Retrieve challenge for address
    const { challenge } = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
    // Sign challenge
    const signature = hexToBuffer(await TEST_WALLET.signMessage(challenge))
    // Send signature to auth API
    const { token } = await promisifyCall((callback: any) => client.auth({ address: TEST_ADDRESS, signature }, callback))

    // wait for 3 sec util token will be expired and try to make a call to secure API
    await sleep(4000)
    const meta = new grpc.Metadata()
    meta.set('authorization', 'Bearer ' + token)
    try {
      await promisifyCall((callback: any) => client.ConnectToCommunicationsNode({ address: TEST_ADDRESS }, meta, callback))

    } catch (e) {
      expect(e.code).to.be.eql(grpc.status.UNAUTHENTICATED)
      expect(e.details).to.be.eql('Not authorized')
    }

    // @ts-ignore
    config.authorization.expiresIn = '1h'
  })
  describe('Handshake', () => {
    it('should create a random challenge', async () => {
      const response = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
      const response2 = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
      expect(response.challenge.length).to.be.eql(config.get('authorization.challengeSize'))
      expect(response.challenge).to.be.instanceof(Buffer)
      expect(response2.challenge).to.be.instanceof(Buffer)
      expect(response2.challenge).to.not.be.eql(response.challenge)
    })
    it('should get error for invalid signature', async () => {
      // Retrieve challenge for address
      const { challenge } = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
      // Sign challenge
      const signature = hexToBuffer(await TEST_WALLET.signMessage(challenge))
      // Make signature not valid
      signature[0] = 22
      // Send signature to auth API
      try {
        await promisifyCall((callback: any) => client.auth({ address: TEST_ADDRESS, signature }, callback))
      } catch (e) {
        expect(e.code).to.be.eql(grpc.status.INVALID_ARGUMENT)
        expect(e.details).to.be.eql('Invalid signature')
      }
    })
    it('should receive JWT token for successfully signed challenge', async () => {
      // Retrieve challenge for address
      const { challenge } = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
      expect(challenge).to.be.instanceof(Buffer)

      // Sign challenge
      const signature = hexToBuffer(await TEST_WALLET.signMessage(challenge))

      // Send signature to auth API
      const { token } = await promisifyCall((callback: any) => client.auth({ address: TEST_ADDRESS, signature }, callback))

      expect(token).to.be.an('string')
      const decodedToken = jwt.verify(
          token,
          config.get<string>('authorization.secret')
      ) as any

      expect(decodedToken.rskAddress).to.be.eql(TEST_ADDRESS)
    })
  })
})
