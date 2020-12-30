import { createChallenge, removeChallengeForAddress, verifyChallenge } from '../../service/HandShake'
import { generateToken } from './utils'

/**
 * Generate 32 bytes challenge and store it for corresponding rsk address
 * @param call
 * @param callback
 */
export const createChallengeHandler = (call: any, callback: any): void => {
  const { request: { address } } = call

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
      throw new Error('Invalid signature')
    }
    removeChallengeForAddress(address)
    callback(null, { token: generateToken(address) })
  } catch (e) {
    callback({ authorizationError: { reason: e.message } }, {})
  }
}
