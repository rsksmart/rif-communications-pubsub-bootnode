import config from 'config'
import jwt from 'jsonwebtoken'

import { loggingFactory } from '../logger'
import { createChallenge, removeChallengeForAddress, verifyChallenge } from './HandShake'

type GRPCApiHandler = (...args: any[]) => void

const logger = loggingFactory('authorization')

export const isAuthorized = (call: any): boolean => {
  if (!call.metadata._internal_repr.authorization == null) {
    return false
  }

  try {
    return Boolean(jwt.verify(
      call.metadata._internal_repr.authorization.toString(),
      config.get<string>('authorization.secret')
    ))
  } catch (e) {
    logger.debug('JWT token verification error', e)
    return false
  }
}

export const generateToken = (rskAddress: string): string => {
  return jwt.sign(
    {
      rskAddress
    },
    config.get<string>('authorization.secret'),
    { expiresIn: config.get<string>('authorization.expiresIn') }
  )
}

export const secureRoute = (handler: GRPCApiHandler) => async (...args: any) => {
  const [call, callback] = args

  if (!isAuthorized(call)) {
    // TODO add proper error messages
    if (callback) {
      callback({ error: 1 })
    } else {
      call.write({ error: 1 })
    }
  }
  await handler(...args)
}

export const authorizationHandler = async (call: any): Promise<void> => {
  const { request: { address } } = call
  if (!address) {
    call.write({ error: 1 })
    call.end()
  }

  // Generate challenge
  const challenge = createChallenge(address)
  // TODO proper message
  call.write({ data: challenge })

  call.on('data', (data: any) => {
    switch (data.type) {
      case 'signedChallenge':
        if (verifyChallenge(address, data.data.signature)) {
          removeChallengeForAddress(address)
          // TODO proper message
          call.write({ data: generateToken(address) })
          call.end()
          return
        }
        // TODO proper error message
        call.write({ error: 1 })
        break
    }
  })
}
