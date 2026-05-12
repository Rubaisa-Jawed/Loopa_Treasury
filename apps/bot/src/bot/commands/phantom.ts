import { InlineKeyboard } from 'grammy'
import { getPhantomConnectionStatus, getPhantomWalletInfo } from '../../agent/mcp/phantom.js'
import type { PilotContext } from '../context.js'
import { replyMarkdown } from '../reply.js'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'
import { getSolBalance } from '../../solana/wallet.js'
import {
  formatSolBalance,
  phantomBrowseUrl,
  phantomFundingPageUrl,
  PHANTOM_LIVE_TEST_SOL,
  solscanAccountUrl
} from '../phantomFunding.js'

export async function phantomCommand(ctx: PilotContext): Promise<void> {
  await sendPhantomStatus(ctx)
}

export async function sendPhantomStatus(ctx: PilotContext): Promise<void> {
  try {
    await ctx.replyWithChatAction('typing')

    let status: string | undefined
    let walletAddress: string | undefined
    let solBalance: number | undefined
    let setupError: string | undefined

    try {
      status = await getPhantomConnectionStatus()
      const wallet = await getPhantomWalletInfo()
      walletAddress = wallet.solanaAddress
      solBalance = await getSolBalance(wallet.solanaAddress).catch((error: unknown) => {
        logger.warn({ error, walletAddress: wallet.solanaAddress }, 'Could not fetch Phantom wallet SOL balance')
        return undefined
      })
    } catch (error) {
      setupError = error instanceof Error ? error.message : 'Phantom MCP did not return a usable wallet yet.'
      logger.warn({ error, telegramId: ctx.from?.id }, 'Phantom MCP status check failed')
    }

    const setup = formatSetupState({ walletAddress, solBalance, status, setupError })
    const keyboard = new InlineKeyboard()
    if (setup.authUrl) {
      keyboard.url('Complete Phantom sign-in', setup.authUrl).row()
    }
    if (walletAddress) {
      const fundingUrl = phantomFundingPageUrl(walletAddress)
      keyboard.url('Fund in Phantom', phantomBrowseUrl(fundingUrl)).row()
      if (env.TELEGRAM_MINI_APP_URL.startsWith('https://')) {
        keyboard.webApp('Open funding page', fundingUrl).row()
      }
      keyboard.text('Refresh balance', 'phantom:refresh').row()
      keyboard.text('Use MCP wallet for tests', 'phantom:use_wallet').row()
      keyboard.url('View wallet on Solscan', solscanAccountUrl(walletAddress)).row()
    } else {
      keyboard.text('Refresh Phantom status', 'phantom:refresh').row()
    }

    await replyMarkdown(
      ctx,
      [
        '*Phantom Agent Wallet*',
        '',
        `Network: \`${env.PHANTOM_MCP_NETWORK_ID}\``,
        '',
        setup.summary,
        '',
        ...setup.details,
        '',
        '*Live test checklist*',
        '1. Complete Phantom sign-in if prompted.',
        `2. Fund the displayed agent wallet with ${PHANTOM_LIVE_TEST_SOL} SOL.`,
        '3. Tap "Use MCP wallet for tests".',
        '4. Ask: `Swap 0.001 SOL to USDC`.',
        '',
        'This is a dedicated Phantom agent wallet for LoopTreasury testing. It is separate from your regular mobile Phantom wallet, so mainnet SOL must be sent to the address shown above.',
        '',
        'Private keys and seed phrases are never required.'
      ].join('\n'),
      { reply_markup: keyboard }
    )
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Phantom command failed')
    await replyMarkdown(
      ctx,
      'I could not check the Phantom agent wallet yet. Try /phantom again after completing Phantom sign-in.'
    )
  }
}

interface SetupStateInput {
  walletAddress?: string
  solBalance?: number
  status?: string
  setupError?: string
}

interface SetupState {
  summary: string
  details: string[]
  authUrl?: string
}

function formatSetupState(input: SetupStateInput): SetupState {
  if (input.walletAddress) {
    const funded = input.solBalance !== undefined && input.solBalance >= PHANTOM_LIVE_TEST_SOL
    return {
      summary: funded ? '*Status:* Connected and funded' : '*Status:* Connected, funding needed',
      details: [
        'Agent wallet:',
        `\`${input.walletAddress}\``,
        '',
        `Balance: \`${formatSolBalance(input.solBalance)} SOL\``,
        funded
          ? 'Ready for the live 0.001 SOL test swap.'
          : `Send ${PHANTOM_LIVE_TEST_SOL} SOL to this exact address, then tap "Refresh balance".`
      ]
    }
  }

  const authUrl = extractAuthUrl(input.setupError)
  const authCode = extractAuthCode(input.setupError)
  if (authUrl || isAuthPending(input.setupError) || isDisconnected(input.status)) {
    return {
      summary: '*Status:* Sign-in required',
      authUrl,
      details: [
        'Phantom needs to create or unlock the dedicated agent wallet for this project.',
        'Choose Google or Apple in the Phantom sign-in page, approve the session, then tap "Refresh Phantom status".',
        authCode ? `Device code: \`${authCode}\`` : ''
      ].filter(Boolean)
    }
  }

  return {
    summary: '*Status:* Needs attention',
    details: [
      'The Phantom agent wallet is not ready yet.',
      'Run /phantom again. If the same issue continues, restart the bot dev process and retry sign-in.'
    ]
  }
}

function extractAuthUrl(message: string | undefined): string | undefined {
  return message?.match(/https:\/\/connect\.phantom\.app\/device-connect\?[^\s]+/)?.[0]
}

function extractAuthCode(message: string | undefined): string | undefined {
  return message?.match(/Device code:\s*([A-Za-z0-9]+)/)?.[1] ?? message?.match(/user_code=([A-Za-z0-9]+)/)?.[1]
}

function isAuthPending(message: string | undefined): boolean {
  return /device authorization|device auth|waiting for approval|sign-in|required|timeout/i.test(message ?? '')
}

function isDisconnected(status: string | undefined): boolean {
  return /"connected"\s*:\s*false|not connected|no session/i.test(status ?? '')
}
