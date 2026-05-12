import { InlineKeyboard } from 'grammy'
import { createUser, getUserByTelegramId } from '../../db/queries.js'
import type { PilotContext } from '../context.js'
import { replyMarkdown } from '../reply.js'
import { formatPortfolioMessage } from '../../utils/format.js'
import { getPortfolioBalances } from '../../agent/tools/portfolio.js'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'

export async function startCommand(ctx: PilotContext): Promise<void> {
  try {
    if (!ctx.from) {
      await replyMarkdown(ctx, 'Welcome to LoopTreasury. Open this chat from your Telegram account to get started.')
      return
    }

    const user = (await getUserByTelegramId(ctx.from.id)) ?? (await createUser(ctx.from.id, ctx.from.username))
    if (!user) {
      await replyMarkdown(ctx, 'I could not create your LoopTreasury profile yet. Please try again in a moment.')
      return
    }

    const keyboard = new InlineKeyboard()
      .text('Connect Wallet', 'connect_wallet')
      .text('How it works', 'how_it_works')

    await replyMarkdown(
      ctx,
      [
        '*Welcome to LoopTreasury*',
        '',
        'Your AI co-pilot for Solana DeFi, right here in Telegram.',
        '',
        'Ask me things like:',
        '- Find the best yield for 500 USDC',
        '- Swap 1 SOL to USDC',
        '- Set an alert if SOL drops below 120',
        '',
        'First, connect a Solana wallet so I can read your portfolio. I will never execute a transaction without your explicit confirmation.'
      ].join('\n'),
      { reply_markup: keyboard }
    )

    if (user.walletAddress) {
      ctx.session.walletAddress = user.walletAddress
      await replyMarkdown(ctx, 'Wallet already connected. Fetching your latest portfolio...')
      const portfolio = await getPortfolioBalances(user.walletAddress)
      await replyMarkdown(ctx, formatPortfolioMessage(portfolio), {
        reply_markup: riskKeyboard()
      })
      return
    }

    if (env.TELEGRAM_MINI_APP_URL) {
      logger.debug({ miniAppUrl: env.TELEGRAM_MINI_APP_URL }, 'Mini App configured for onboarding')
    }
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Start command failed')
    await replyMarkdown(ctx, 'I ran into an issue starting onboarding. Please try /start again.')
  }
}

export function riskKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Conservative', 'risk:conservative')
    .text('Balanced', 'risk:balanced')
    .text('Aggressive', 'risk:aggressive')
}
