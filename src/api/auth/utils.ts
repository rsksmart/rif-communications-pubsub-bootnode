import config from 'config'
import jwt from 'jsonwebtoken'
import grpc from 'grpc'

import { loggingFactory } from '../../logger'

type GRPCApiHandler = (...args: any[]) => void

const logger = loggingFactory('authorization')

export const isAuthorized = (call: any): boolean => {
  if (!call.metadata.get('authorization')) {
    return false
  }

  try {
    return Boolean(jwt.verify(
        call.metadata.get('authorization')?.toString().split(' ')[1],
        config.get<string>('authorization.secret')
    ))
  } catch (e) {
    logger.debug('JWT token verification error', e)
    return false
  }
}

/**
 * Generate JWT token based on RSK address
 * secret and expiration of token configurable from node-config
 * @param rskAddress
 */
export const generateToken = (rskAddress: string): string => {
  return jwt.sign(
      { rskAddress },
      config.get<string>('authorization.secret'),
      { expiresIn: config.get<string>('authorization.expiresIn') }
  )
}

/**
 * Auth Middleware for API handlers
 * @param handler
 */
export const secureRoute = (handler: GRPCApiHandler) => async (...args: any) => {
  const [call, callback] = args
  if (!isAuthorized(call)) {
    const error = { code: grpc.status.UNAUTHENTICATED, message: 'Not authorized' }
    if (callback) {
      callback(error)
    } else {
      call.emit('error', error)
      call.end()
    }
    return
  }

  await handler(...args)
}
