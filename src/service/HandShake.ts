const challengeMap = new Map<string, Buffer>()

export const createChallenge = (address: string): Buffer => {
  // TODO geenrate random
  const challenge = Buffer.from([])
  challengeMap.set(address, challenge)
  return challenge
}

export const verifyChallenge = (address: string, sig: string | Buffer): boolean => {
  const challenge = challengeMap.get(address)

  if (!challenge) {
    throw new Error(`Challenge not found for address ${address}`)
  }

  // TODO verify sig
  return true
}
