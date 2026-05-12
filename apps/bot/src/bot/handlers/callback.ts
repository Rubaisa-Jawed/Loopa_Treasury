import { InlineKeyboard } from 'grammy'
import type { RiskAppetite } from '@pilot/shared'
import {
  getUserByTelegramId,
  updateUserWallet,
  updateNotificationPreference,
  updateRiskAppetite
} from '../../db/queries.js'
import type { PilotContext } from '../context.js'
import { answerCallback, replyMarkdown } from '../reply.js'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'
import { assertSwapRateLimit } from '../middleware/rateLimit.js'
import { cancelSwap, executeSwap, getPendingSwap, simulateSwapExecution } from '../../agent/tools/swap.js'
import { getPhantomWalletInfo } from '../../agent/mcp/phantom.js'
import { formatTokenAmount } from '../../utils/format.js'
import { getSolBalance } from '../../solana/wallet.js'
import {
  formatSolBalance,
  phantomBrowseUrl,
  phantomFundingPageUrl,
  PHANTOM_LIVE_TEST_SOL,
  solscanAccountUrl
} from '../phantomFunding.js'
import { sendPhantomStatus } from '../commands/phantom.js'

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

    if (data.startsWith('confirm:phantom:')) {
      await handlePhantomFinalConfirmation(ctx, data.replace('confirm:phantom:', ''))
      return
    }

    if (data === 'phantom:use_wallet') {
      await handleUsePhantomWallet(ctx)
      return
    }

    if (data === 'phantom:refresh') {
      await answerCallback(ctx, 'Refreshing Phantom wallet...')
      await sendPhantomStatus(ctx)
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
    keyboard.url('Open Phantom App', phantomMobileBrowseUrl()).row()
    keyboard.url('Open Phantom Website', 'https://phantom.app/')

    await answerCallback(ctx)
    await replyMarkdown(
      ctx,
      [
        '*Connect your wallet*',
        '',
        'For this bot MVP, paste your public Solana wallet address here. LoopTreasury will use it for read-only portfolio checks.',
        '',
        'For executable swap tests, use /phantom and connect the Phantom MCP agent wallet. Never paste a seed phrase or private key.'
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

    await answerCallback(ctx, 'Simulating with Phantom...')
    await replyMarkdown(ctx, 'Confirmed. I am building the transaction and asking Phantom MCP to simulate it first.')
    const simulation = await simulateSwapExecution(swapId, user.walletAddress)
    await replyMarkdown(
      ctx,
      [
        '*Phantom Simulation Ready*',
        '',
        `Swap: ${formatTokenAmount(simulation.pending.inputAmount, simulation.pending.fromToken)} -> ~${formatTokenAmount(
          simulation.pending.expectedOutput,
          simulation.pending.toToken
        )}`,
        '',
        simulation.simulationSummary,
        '',
        'Approve the simulation to sign and send with the Phantom MCP agent wallet.'
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Sign & Send', callback_data: `confirm:phantom:${swapId}` },
              { text: 'Cancel', callback_data: `cancel:swap:${swapId}` }
            ]
          ]
        }
      }
    )
  } catch (error) {
    logger.error({ error, swapId, telegramId: ctx.from?.id }, 'Swap simulation confirmation failed')
    await replyMarkdown(ctx, formatPhantomExecutionError(error))
  }
}

async function handlePhantomFinalConfirmation(ctx: PilotContext, swapId: string): Promise<void> {
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

    await answerCallback(ctx, 'Signing with Phantom MCP...')
    await replyMarkdown(ctx, 'Final approval received. Phantom MCP is signing and broadcasting the transaction now.')
    const result = await executeSwap(swapId, user.walletAddress)
    const pending = result.pending
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
    await replyMarkdown(ctx, formatPhantomExecutionError(error))
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

async function handleUsePhantomWallet(ctx: PilotContext): Promise<void> {
  try {
    if (!ctx.from) {
      await answerCallback(ctx, 'Open LoopTreasury from Telegram.')
      return
    }

    const user = await getUserByTelegramId(ctx.from.id)
    if (!user) {
      await answerCallback(ctx, 'Use /start first.')
      await replyMarkdown(ctx, 'Use /start first so I can create your LoopTreasury profile.')
      return
    }

    const wallet = await getPhantomWalletInfo()
    const solBalance = await getSolBalance(wallet.solanaAddress).catch((error: unknown) => {
      logger.warn({ error, walletAddress: wallet.solanaAddress }, 'Could not fetch Phantom wallet balance')
      return undefined
    })
    await updateUserWallet(user.id, wallet.solanaAddress)
    ctx.session.walletAddress = wallet.solanaAddress
    ctx.session.awaitingWalletAddress = false
    const fundingUrl = phantomFundingPageUrl(wallet.solanaAddress)
    const keyboard = new InlineKeyboard()
      .url('Fund in Phantom', phantomBrowseUrl(fundingUrl))
      .row()
      .url('View wallet on Solscan', solscanAccountUrl(wallet.solanaAddress))

    await answerCallback(ctx, 'MCP wallet connected.')
    await replyMarkdown(
      ctx,
      [
        '*Phantom MCP wallet connected for executable tests*',
        '',
        `Wallet: \`${wallet.solanaAddress}\``,
        '',
        `Balance: \`${formatSolBalance(solBalance)} SOL\``,
        '',
        solBalance !== undefined && solBalance >= PHANTOM_LIVE_TEST_SOL
          ? 'Ready. Ask: `Swap 0.001 SOL to USDC`.'
          : `Before the live swap, fund this wallet with ${PHANTOM_LIVE_TEST_SOL} SOL and tap /phantom to refresh.`,
        '',
        'LoopTreasury will still require two taps: first to simulate, then to sign and send.'
      ].join('\n'),
      { reply_markup: keyboard }
    )
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Failed to connect Phantom MCP wallet')
    await answerCallback(ctx, 'Phantom MCP not ready.')
    await replyMarkdown(
      ctx,
      'I could not get the Phantom MCP wallet yet. Run /phantom, complete Phantom authentication on this machine, then try the button again.'
    )
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

function formatPhantomExecutionError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown Phantom MCP error'
  if (/insufficient|balance|fund|not enough/i.test(message)) {
    return [
      '*Live test wallet needs SOL*',
      '',
      'The Phantom agent wallet is connected, but it does not have enough mainnet SOL for this swap and network fees.',
      '',
      `Open /phantom, fund the displayed wallet with ${PHANTOM_LIVE_TEST_SOL} SOL, then try the same swap again.`
    ].join('\n')
  }

  if (/authorization|device|sign.?in|session|approval/i.test(message)) {
    return [
      '*Phantom sign-in is not finished*',
      '',
      'Open /phantom, complete the Phantom sign-in prompt, then refresh the wallet status.'
    ].join('\n')
  }

  return [
    '*Phantom could not finish this transaction.*',
    '',
    'No funds moved. Open /phantom to check the agent wallet, balance, and funding link.',
    '',
    'Quotes and portfolio analysis still work in watch-only mode.'
  ].join('\n')
}

function phantomMobileBrowseUrl(): string {
  const target = env.TELEGRAM_MINI_APP_URL.startsWith('https://')
    ? env.TELEGRAM_MINI_APP_URL
    : 'https://phantom.com'
  const ref = env.TELEGRAM_MINI_APP_URL.startsWith('https://')
    ? env.TELEGRAM_MINI_APP_URL
    : 'https://phantom.com'

  return `https://phantom.app/ul/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(ref)}`
}
