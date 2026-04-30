import type { PilotContext } from '../context.js'
import { replyMarkdown } from '../reply.js'
import { logger } from '../../utils/logger.js'

export async function helpCommand(ctx: PilotContext): Promise<void> {
  try {
    await replyMarkdown(
      ctx,
      [
        '*What Pilot can do*',
        '',
        '- View wallet balances and DeFi positions',
        '- Compare yield across Kamino, Raydium, and Marinade',
        '- Prepare Jupiter swaps with confirmation buttons',
        '- Set price alerts and monitoring preferences',
        '- Pay for premium data with x402 micropayments when useful',
        '',
        '*Try asking*',
        '- What is my portfolio worth?',
        '- Find the best yield for 500 USDC',
        '- Swap 0.5 SOL to USDC',
        '- Alert me if SOL goes below 120',
        '- What is SOL sentiment right now?',
        '',
        'Commands: /start, /portfolio, /settings, /help'
      ].join('\n')
    )
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Help command failed')
    await ctx.reply('I had trouble showing help. Please try again.')
  }
}
