import type { NextFunction } from 'grammy'
import type { PilotContext } from '../context.js'
import { createUser, getUserByTelegramId } from '../../db/queries.js'
import { logger } from '../../utils/logger.js'

export async function authMiddleware(ctx: PilotContext, next: NextFunction): Promise<void> {
  try {
    if (!ctx.from) {
      await next()
      return
    }

    const existing = await getUserByTelegramId(ctx.from.id)
    const user = existing ?? (await createUser(ctx.from.id, ctx.from.username))

    if (user) {
      ctx.session.walletAddress = user.walletAddress
      ctx.session.riskAppetite =
        user.riskAppetite === 'conservative' || user.riskAppetite === 'aggressive' ? user.riskAppetite : 'balanced'
    }

    await next()
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Auth middleware failed')
    await ctx.reply('I had trouble loading your LoopTreasury profile. Please try again in a moment.')
  }
}
