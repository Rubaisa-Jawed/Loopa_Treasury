import { InlineKeyboard } from 'grammy'
import { getUserByTelegramId } from '../../db/queries.js'
import { getPortfolioBalances } from '../../agent/tools/portfolio.js'
import type { PilotContext } from '../context.js'
import { replyMarkdown } from '../reply.js'
import { formatPortfolioMessage } from '../../utils/format.js'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'

export async function portfolioCommand(ctx: PilotContext): Promise<void> {
  try {
    if (!ctx.from) {
      await replyMarkdown(ctx, 'Open LoopTreasury from Telegram to view a portfolio.')
      return
    }

    const user = await getUserByTelegramId(ctx.from.id)
    if (!user?.walletAddress) {
      await replyMarkdown(ctx, 'Please connect your wallet first. Use /start to begin.')
      return
    }

    await ctx.replyWithChatAction('typing')
    const portfolio = await getPortfolioBalances(user.walletAddress)
    const dashboardUrl = `${env.TELEGRAM_MINI_APP_URL}?wallet=${encodeURIComponent(user.walletAddress)}`
    const keyboard = new InlineKeyboard().url('Open Dashboard 📊', dashboardUrl)

    await replyMarkdown(ctx, formatPortfolioMessage(portfolio), { reply_markup: keyboard })
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Portfolio command failed')
    await replyMarkdown(ctx, 'I ran into an issue fetching your portfolio. Please try again.')
  }
}
