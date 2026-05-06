import { InlineKeyboard } from 'grammy'
import type { RiskAppetite } from '@pilot/shared'
import {
  getUserByTelegramId,
  updateNotificationPreference,
  updateRiskAppetite
} from '../../db/queries.js'
import type { PilotContext } from '../context.js'
import { answerCallback, replyMarkdown } from '../reply.js'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'
import { assertSwapRateLimit } from '../middleware/rateLimit.js'
import { cancelSwap, executeSwap, getPendingSwap } from '../../agent/tools/swap.js'
import { formatTokenAmount } from '../../utils/format.js'

export async function callbackHandler(ctx: PilotContext): Promise<void> {
  try {
    const data = ctx.callbackQuery?.data
    if (!data) {
      await answerCallback(ctx)
      return
    }

    if (data === 'connect_wallet') {
      await handleConnectWallet(ctx)
      return
    }

    if (data === 'how_it_works') {
      await handleHowItWorks(ctx)
      return
    }

    if (data.startsWith('risk:')) {
      await handleRiskSelection(ctx, data)
      return
    }

    if (data.startsWith('confirm:swap:')) {
      await handleSwapConfirmation(ctx, data.replace('confirm:swap:', ''))
      return
    }

    if (data.startsWith('cancel:swap:')) {
      await handleSwapCancel(ctx, data.replace('cancel:swap:', ''))
      return
    }

    if (data.startsWith('settings:')) {
      await handleSettingsToggle(ctx, data.replace('settings:', ''))
      return
    }

    await answerCallback(ctx, 'LoopTreasury does not recognize that action yet.')
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Callback handler failed')
    await answerCallback(ctx, 'Something went wrong.')
    await replyMarkdown(ctx, 'I ran into an issue handling that action. Please try again.')
  }
}

async function handleConnectWallet(ctx: PilotContext): Promise<void> {
  try {
    ctx.session.awaitingWalletAddress = true
    const keyboard = new InlineKeyboard()
    if (env.TELEGRAM_MINI_APP_URL.startsWith('https://')) {
      keyboard.webApp('Open LoopTreasury Dashboard', env.TELEGRAM_MINI_APP_URL).row()
    }
    keyboard.url('Open Phantom', 'https://phantom.app/')

    await answerCallback(ctx)
    await replyMarkdown(
      ctx,
      [
        '*Connect your wallet*',
        '',
        'For this bot MVP, paste your public Solana wallet address here. LoopTreasury will use it for read-only portfolio checks.',
        '',
        'Transactions still require a separate confirm tap and Phantom MCP signing. Never paste a seed phrase or private key.'
      ].join('\n'),
      { reply_markup: keyboard }
    )
  } catch (error) {
    logger.error({ error }, 'Connect wallet callback failed')
    await replyMarkdown(ctx, 'I could not start wallet connection. Please try /start again.')
  }
}

async function handleHowItWorks(ctx: PilotContext): Promise<void> {
  try {
    await answerCallback(ctx)
    await replyMarkdown(
      ctx,
      [
        '*How LoopTreasury works*',
        '',
        '1. You connect a Solana wallet for read-only portfolio data.',
        '2. You ask for swaps, yield, alerts, or market context in plain English.',
        '3. LoopTreasury fetches live protocol data and prepares actions.',
        '4. Anything on-chain waits for your explicit Confirm button.',
        '',
        'LoopTreasury is non-custodial: it never asks for private keys.'
      ].join('\n')
    )
  } catch (error) {
    logger.error({ error }, 'How it works callback failed')
  }
}

async function handleRiskSelection(ctx: PilotContext, data: string): Promise<void> {
  try {
    if (!ctx.from) {
      await answerCallback(ctx, 'Open LoopTreasury from your Telegram account.')
      return
    }

    const risk = data.replace('risk:', '')
    if (!isRisk(risk)) {
      await answerCallback(ctx, 'Unknown risk setting.')
      return
    }

    const user = await getUserByTelegramId(ctx.from.id)
    if (!user) {
      await answerCallback(ctx, 'Use /start first.')
      return
    }

    await updateRiskAppetite(user.id, risk)
    ctx.session.riskAppetite = risk
    await answerCallback(ctx, `Risk set to ${risk}`)
    await replyMarkdown(ctx, `Risk appetite updated to *${risk}*.`)
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Risk selection failed')
    await replyMarkdown(ctx, 'I could not update that setting. Please try again.')
  }
}

async function handleSwapConfirmation(ctx: PilotContext, swapId: string): Promise<void> {
  try {
    if (!ctx.from) {
      await answerCallback(ctx, 'Open LoopTreasury from Telegram to confirm.')
      return
    }

    const user = await getUserByTelegramId(ctx.from.id)
    if (!user?.walletAddress) {
      await answerCallback(ctx, 'Connect wallet first.')
      await replyMarkdown(ctx, 'Please connect your wallet with /start before confirming a swap.')
      return
    }

    const allowed = await assertSwapRateLimit(ctx.from.id)
    if (!allowed) {
      await answerCallback(ctx, 'Swap limit reached.')
      await replyMarkdown(ctx, 'You have reached the 10 swaps per hour safety limit. Please try again later.')
      return
    }

    const pending = await getPendingSwap(swapId)
    if (!pending) {
      await answerCallback(ctx, 'Swap expired.')
      await replyMarkdown(ctx, 'That swap preview expired. Ask me for a fresh quote and I will prepare a new one.')
      return
    }

    await answerCallback(ctx, 'Executing swap...')
    await replyMarkdown(ctx, 'Confirmed. I am building and sending the transaction now.')
    const result = await executeSwap(swapId, user.walletAddress)
    const solscan = `https://solscan.io/tx/${result.signature}${
      env.SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${env.SOLANA_NETWORK}`
    }`

    if (result.status === 'confirmed') {
      await replyMarkdown(
        ctx,
        [
          '*Swap confirmed*',
          '',
          `${formatTokenAmount(pending.inputAmount, pending.fromToken)} -> ~${formatTokenAmount(
            pending.expectedOutput,
            pending.toToken
          )}`,
          `Transaction: [View on Solscan](${solscan})`,
          `Signature: \`${result.signature}\``
        ].join('\n')
      )
      return
    }

    await replyMarkdown(
      ctx,
      [
        '*Swap sent, but confirmation failed*',
        '',
        `Check Solscan: [transaction](${solscan})`,
        `Signature: \`${result.signature}\``
      ].join('\n')
    )
  } catch (error) {
    logger.error({ error, swapId, telegramId: ctx.from?.id }, 'Swap confirmation failed')
    await replyMarkdown(
      ctx,
      'I could not execute that swap. If Phantom MCP is not configured yet, the quote flow still works but signing will fail safely.'
    )
  }
}

async function handleSwapCancel(ctx: PilotContext, swapId: string): Promise<void> {
  try {
    await cancelSwap(swapId)
    await answerCallback(ctx, 'Swap cancelled.')
    await replyMarkdown(ctx, 'Swap cancelled. Nothing was sent on-chain.')
  } catch (error) {
    logger.error({ error, swapId }, 'Swap cancellation failed')
  }
}

async function handleSettingsToggle(ctx: PilotContext, setting: string): Promise<void> {
  try {
    if (!ctx.from) {
      await answerCallback(ctx)
      return
    }

    const user = await getUserByTelegramId(ctx.from.id)
    if (!user) {
      await answerCallback(ctx, 'Use /start first.')
      return
    }

    if (setting === 'daily_summary') {
      await updateNotificationPreference(user.id, 'dailySummaryEnabled', !user.dailySummaryEnabled)
    } else if (setting === 'large_moves') {
      await updateNotificationPreference(user.id, 'largeMovesEnabled', !user.largeMovesEnabled)
    } else if (setting === 'position_changes') {
      await updateNotificationPreference(user.id, 'positionChangesEnabled', !user.positionChangesEnabled)
    }

    await answerCallback(ctx, 'Setting updated.')
    await replyMarkdown(ctx, 'Setting updated. Use /settings to review your preferences.')
  } catch (error) {
    logger.error({ error, setting, telegramId: ctx.from?.id }, 'Settings toggle failed')
    await answerCallback(ctx, 'Could not update setting.')
  }
}

function isRisk(value: string): value is RiskAppetite {
  return value === 'conservative' || value === 'balanced' || value === 'aggressive'
}
