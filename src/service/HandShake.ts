import config from 'config'
import { randomBytes } from 'crypto'
import { utils } from 'ethers'

const challengeMap = new Map<string, string>()

export const createChallenge = (address: string): string => {
  const challenge = randomBytes(config.get<number>('authorization.challengeSize')).toString('hex')
  challengeMap.set(address, challenge)
  return challenge
}

export const verifyChallenge = (address: string, sig: string | Buffer): boolean => {
  const challenge = challengeMap.get(address)

  if (!challenge) {
    throw new Error(`Challenge not found for address ${address}`)
  }

  return utils.verifyMessage(challenge, sig) === address
}

export const removeChallengeForAddress = (address: string): void => {
  challengeMap.delete(address)
}
