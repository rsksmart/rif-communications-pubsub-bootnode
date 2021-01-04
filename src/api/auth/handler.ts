import grpc from 'grpc'

import { loggingFactory } from '../../logger'
import { createChallenge, removeChallengeForAddress, verifyChallenge } from '../../service/HandShake'
import { generateToken } from './utils'

const logger = loggingFactory('auth')

/**
 * Generate 32 bytes challenge and store it for corresponding rsk address
 * @param call
 * @param callback
 */
export const createChallengeHandler = (call: any, callback: any): void => {
  const { request: { address } } = call

  logger.info(`Creating challenge for address = ${address}`)
  callback(null, { challenge: createChallenge(address) })
}

/**
 * Verify challenge signature and create an JWT token
 * @param call
 * @param callback
 */
export const authorizationHandler = (call: any, callback: any) => {
  const { request: { address, signature } } = call

  try {
    if (!verifyChallenge(address, signature)) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid signature' }, {})
      return
    }

    removeChallengeForAddress(address)
    logger.info(`Address = ${address} successfully authorized`)
    callback(null, { token: generateToken(address) })
  } catch (e) {
    callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid signature' }, {})
  }
}
