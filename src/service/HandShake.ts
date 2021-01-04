import config from 'config'
import { randomBytes } from 'crypto'
import { utils } from 'ethers'

import { loggingFactory } from '../logger'

const logger = loggingFactory('handshake')

const challengeMap = new Map<string, Buffer>()

export const createChallenge = (address: string): Buffer => {
  const challenge = randomBytes(config.get<number>('authorization.challengeSize'))
  challengeMap.set(address, challenge)
  logger.debug(`Created challenge for address = ${address}`)
  return challenge
}

export const verifyChallenge = (address: string, sig: Buffer): boolean => {
  const challenge = challengeMap.get(address)

  if (!challenge) {
    logger.debug(`Challenge not found for address ${address}`)
    throw new Error(`Challenge not found for address ${address}`)
  }

  return utils.verifyMessage(challenge, sig) === address
}

export const removeChallengeForAddress = (address: string): void => {
  logger.debug(`Challenge for address = ${address} removed`)
  challengeMap.delete(address)
}
