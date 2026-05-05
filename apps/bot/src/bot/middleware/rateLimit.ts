import type { NextFunction } from 'grammy'
import type { PilotContext } from '../context.js'
import { getRedis } from '../../utils/redis.js'
import { logger } from '../../utils/logger.js'

export function rateLimitMiddleware(limit: number, windowSeconds: number) {
  return async (ctx: PilotContext, next: NextFunction): Promise<void> => {
    try {
      if (!ctx.from) {
        await next()
        return
      }

      const redis = getRedis()
      const key = `rate:messages:${ctx.from.id}`
      const count = await redis.incr(key)

      if (count === 1) {
        await redis.expire(key, windowSeconds)
      }

      if (count > limit) {
        await ctx.reply('LoopTreasury is taking a short breather for this chat. You can send more messages in a few minutes.')
        return
      }

      await next()
    } catch (error) {
      logger.error({ error, telegramId: ctx.from?.id }, 'Rate limit middleware failed')
      await next()
    }
  }
}

export async function assertSwapRateLimit(telegramId: number): Promise<boolean> {
  try {
    const redis = getRedis()
    const key = `rate:swaps:${telegramId}`
    const count = await redis.incr(key)

    if (count === 1) {
      await redis.expire(key, 60 * 60)
    }

    return count <= 10
  } catch (error) {
    logger.error({ error, telegramId }, 'Swap rate limit check failed')
    return false
  }
}
