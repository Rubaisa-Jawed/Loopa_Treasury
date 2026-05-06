import { getConversationHistory, getUserByTelegramId, saveConversation, updateUserWallet } from '../../db/queries.js'
import { runAgent } from '../../agent/index.js'
import { getPortfolioBalances } from '../../agent/tools/portfolio.js'
import { prepareSwap } from '../../agent/tools/swap.js'
import { validateSolanaAddress } from '../../solana/wallet.js'
import { formatPortfolioMessage } from '../../utils/format.js'
import { logger } from '../../utils/logger.js'
import type { PilotContext } from '../context.js'
import { replyMarkdown, toGrammyInlineKeyboard } from '../reply.js'
import { riskKeyboard } from '../commands/start.js'

export async function messageHandler(ctx: PilotContext): Promise<void> {
  try {
    const text = ctx.message?.text?.trim()
    if (!text || !ctx.from) {
      return
    }

    await ctx.replyWithChatAction('typing')

    const user = await getUserByTelegramId(ctx.from.id)
    if (!user) {
      await replyMarkdown(ctx, 'Please use /start first so I can create your LoopTreasury profile.')
      return
    }

    if (ctx.session.awaitingWalletAddress || (!user.walletAddress && validateSolanaAddress(text))) {
      await handleWalletAddress(ctx, user.id, text)
      return
    }

    if (!user.walletAddress) {
      await replyMarkdown(ctx, 'Please connect your wallet first. Use /start to begin.')
      return
    }

    const directSwap = parseDirectSwapQuote(text)
    if (directSwap) {
      const response = await prepareSwap({
        ...directSwap,
        walletAddress: user.walletAddress
      })
      await saveConversation(user.id, text, response.text)
      await replyMarkdown(ctx, response.text, {
        reply_markup: toGrammyInlineKeyboard(response.inlineKeyboard)
      })
      return
    }

    const history = await getConversationHistory(user.id)
    const response = await runAgent({
      message: text,
      history,
      user
    })

    await saveConversation(user.id, text, response.text)
    await replyMarkdown(ctx, response.text, {
      reply_markup: toGrammyInlineKeyboard(response.inlineKeyboard)
    })
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Message handler failed')
    await replyMarkdown(ctx, 'I ran into an issue fetching that data. Please try again.')
  }
}

export async function webAppDataHandler(ctx: PilotContext): Promise<void> {
  try {
    if (!ctx.from) {
      return
    }

    const data = ctx.message?.web_app_data?.data
    if (!data) {
      return
    }

    const parsed = JSON.parse(data) as unknown
    if (!isWebAppPayload(parsed)) {
      await replyMarkdown(ctx, 'I received Mini App data, but could not understand it.')
      return
    }

    if (parsed.type === 'wallet_connected') {
      const user = await getUserByTelegramId(ctx.from.id)
      if (!user) {
        await replyMarkdown(ctx, 'Use /start first so I can create your LoopTreasury profile.')
        return
      }

      await handleWalletAddress(ctx, user.id, parsed.walletAddress)
      return
    }

    if (parsed.type === 'swap_request') {
      const user = await getUserByTelegramId(ctx.from.id)
      if (!user?.walletAddress) {
        await replyMarkdown(ctx, 'Please connect your wallet first. Use /start to begin.')
        return
      }

      const prompt = `Swap ${parsed.amount} ${parsed.fromToken} to ${parsed.toToken}`
      const history = await getConversationHistory(user.id)
      const response = await runAgent({ message: prompt, history, user })
      await saveConversation(user.id, prompt, response.text)
      await replyMarkdown(ctx, response.text, { reply_markup: toGrammyInlineKeyboard(response.inlineKeyboard) })
    }
  } catch (error) {
    logger.error({ error, telegramId: ctx.from?.id }, 'Web App data handler failed')
    await replyMarkdown(ctx, 'I could not process that Mini App action. Please try again.')
  }
}

async function handleWalletAddress(ctx: PilotContext, userId: number, walletAddress: string): Promise<void> {
  try {
    if (!validateSolanaAddress(walletAddress)) {
      await replyMarkdown(ctx, 'That does not look like a valid Solana public wallet address. Please paste the address again.')
      return
    }

    await updateUserWallet(userId, walletAddress)
    ctx.session.walletAddress = walletAddress
    ctx.session.awaitingWalletAddress = false

    await replyMarkdown(ctx, 'Wallet connected. Fetching your portfolio snapshot...')
    const portfolio = await getPortfolioBalances(walletAddress)
    await replyMarkdown(ctx, formatPortfolioMessage(portfolio), {
      reply_markup: riskKeyboard()
    })
  } catch (error) {
    logger.error({ error, userId }, 'Wallet address handling failed')
    await replyMarkdown(ctx, 'I could not connect that wallet yet. Please try again.')
  }
}

type WebAppPayload =
  | {
      type: 'wallet_connected'
      walletAddress: string
    }
  | {
      type: 'swap_request'
      fromToken: string
      toToken: string
      amount: number
    }

function isWebAppPayload(value: unknown): value is WebAppPayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  if (record.type === 'wallet_connected') {
    return typeof record.walletAddress === 'string'
  }

  if (record.type === 'swap_request') {
    return (
      typeof record.fromToken === 'string' &&
      typeof record.toToken === 'string' &&
      typeof record.amount === 'number'
    )
  }

  return false
}

interface DirectSwapQuote {
  amount: number
  fromToken: string
  toToken: string
  quoteOnly: boolean
}

function parseDirectSwapQuote(text: string): DirectSwapQuote | undefined {
  const normalized = text.replaceAll(',', '').trim()
  const match = normalized.match(
    /\b(?:prepare\s+(?:a\s+)?quote\s+(?:to\s+)?swap|quote\s+(?:a\s+)?swap|swap)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{2,44})\s+(?:to|for|into|->)\s+([A-Za-z0-9]{2,44})/i
  )

  if (!match) {
    return undefined
  }

  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined
  }

  return {
    amount,
    fromToken: match[2],
    toToken: match[3],
    quoteOnly: /\b(do not execute|don't execute|quote only|no execute|without executing)\b/i.test(text)
  }
}
