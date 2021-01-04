import config from 'config'
import chai from 'chai'
import sinonChai from 'sinon-chai'

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
