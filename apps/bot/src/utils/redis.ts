import { Redis } from 'ioredis'
import { env } from './env.js'
import { logger } from './logger.js'

let redis: Redis | undefined

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    })

    redis.on('error', (error: Error) => {
      logger.error({ error }, 'Redis connection error')
    })
  }

  return redis
}

export async function closeRedis(): Promise<void> {
  try {
    if (redis) {
      await redis.quit()
      redis = undefined
    }
  } catch (error) {
    logger.error({ error }, 'Failed to close Redis connection')
  }
}
