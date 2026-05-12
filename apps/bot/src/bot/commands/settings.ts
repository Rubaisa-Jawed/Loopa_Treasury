import { InlineKeyboard } from 'grammy'
import { getUserByTelegramId } from '../../db/queries.js'
import type { PilotContext } from '../context.js'
import { replyMarkdown } from '../reply.js'
import { logger } from '../../utils/logger.js'

export async function settingsCommand(ctx: PilotContext): Promise<void> {
  try {
    if (!ctx.from) {
      await replyMarkdown(ctx, 'Open LoopTreasury from Telegram to update settings.')
      return
    }

    const user = await getUserByTelegramId(ctx.from.id)
    if (!user) {
      await replyMarkdown(ctx, 'Use /start first so I can create your LoopTreasury profile.')
      return
    }

    const keyboard = new InlineKeyboard()
      .text('Conservative', 'risk:conservative')
      .text('Balanced', 'risk:balanced')
      .text('Aggressive', 'risk:aggressive')
      .row()
      .text(user.dailySummaryEnabled ? 'Daily Summary: On' : 'Daily Summary: Off', 'settings:daily_summary')
      .row()
      .text(user.largeMovesEnabled ? 'Large Moves: On' : 'Large Moves: Off', 'settings:large_moves')
      .row()
      .text(user.positionChangesEnabled ? 'Position Changes: On' : 'Position Changes: Off', 'settings:position_changes')

    await replyMarkdown(
      ctx,
      [
        '*LoopTreasury Settings*',
        '',
        `Risk appetite: *${user.riskAppetite}*`,
        `Monitoring frequency: *${user.monitoringFrequency}*`,
        `Wallet: ${user.walletAddress ? `\`${user.walletAddress}\`` : 'Not connected'}`,
        '',
        'Update your preferences below.'
      ].join('\n'),
      { reply_markup: keyboard }
    )
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Settings command failed')
    await replyMarkdown(ctx, 'I ran into an issue loading settings. Please try again.')
  }
}
