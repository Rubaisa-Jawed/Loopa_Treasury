import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'AGENT_WALLET_PRIVATE_KEY',
      '*.AGENT_WALLET_PRIVATE_KEY',
      'authorization',
      '*.authorization',
      'headers.authorization',
      'privateKey',
      '*.privateKey'
    ],
    censor: '[redacted]'
  },
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true
          }
        }
})
