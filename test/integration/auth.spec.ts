import config from 'config'
import chai from 'chai'
import sinonChai from 'sinon-chai'
import grpc from 'grpc'

import { getGRPCClient, promisifyCall } from '../utils'
import { main as startServer } from '../../src/api-server'

chai.use(sinonChai)
const expect = chai.expect

describe('Auth for gRPC', function() {
  this.timeout(5000)

  let client: any
  let server: any

  const TEST_ADDRESS = '0xic82ncjdksnflTestAddress'

  before(async () => {
    server = await startServer()
    client = getGRPCClient(`localhost:${config.get('grpcPort')}`)
    console.log(`Client created for localhost:${config.get('grpcPort')}`)
  })
  it('should return error when accessing secure route without auth', async () => {
    try {
      await promisifyCall((callback: any) => client.updateAddress({ address: TEST_ADDRESS }, callback))
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
  describe('Create Challenge', () => {
    it('should create a random challenge', async () => {
      const response = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
      const response2 = await promisifyCall((callback: any) => client.createChallenge({ address: TEST_ADDRESS }, callback))
      expect(response.challenge).to.be.instanceof(Buffer)
      expect(response2.challenge).to.be.instanceof(Buffer)
      expect(response2.challenge).to.not.be.eql(response.challenge)
    })
  })
})
