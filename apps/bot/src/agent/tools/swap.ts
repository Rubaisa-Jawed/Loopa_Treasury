import { randomUUID } from 'node:crypto'
import type { AgentResponse, InlineKeyboard, PendingSwap } from '@pilot/shared'
import { tokenSymbolToMint } from '@pilot/shared'
import { validateSolanaAddress, waitForConfirmation } from '../../solana/wallet.js'
import {
  amountToAtomic,
  atomicToAmount,
  buildSwapTransaction,
  getQuote,
  routeLabels,
  type QuoteResponse
} from '../../solana/jupiter.js'
import { getRedis } from '../../utils/redis.js'
import { formatFixedTable, formatTokenAmount } from '../../utils/format.js'
import { logger } from '../../utils/logger.js'
import { signAndSendWithPhantom } from '../mcp/phantom.js'
import { parsePrepareSwapInput } from './validation.js'

interface PrepareSwapParams {
  fromToken: string
  toToken: string
  amount: number
  walletAddress: string
  quoteOnly?: boolean
}

interface StoredSwap {
  pending: PendingSwap
  quote: QuoteResponse
  walletAddress: string
  createdAt: string
}

export interface PreparedSwapResult extends AgentResponse {
  kind: 'pending_swap'
  swapId: string
  details: PendingSwap
}

export async function prepareSwap(params: PrepareSwapParams): Promise<PreparedSwapResult> {
  try {
    const safeParams = parsePrepareSwapInput(params)
    logger.info(
      {
        fromToken: safeParams.fromToken,
        toToken: safeParams.toToken,
        amount: safeParams.amount,
        walletAddress: safeParams.walletAddress
      },
      'Agent tool: swap_tokens prepare'
    )

    if (!validateSolanaAddress(safeParams.walletAddress)) {
      throw new Error('Invalid wallet address')
    }

    if (!Number.isFinite(safeParams.amount) || safeParams.amount <= 0) {
      throw new Error('Swap amount must be greater than zero')
    }

    const inputMint = tokenSymbolToMint(safeParams.fromToken)
    const outputMint = tokenSymbolToMint(safeParams.toToken)
    const atomicAmount = amountToAtomic(safeParams.amount, safeParams.fromToken)
    const quote = await getQuote(inputMint, outputMint, atomicAmount, 50)
    const expectedOutput = atomicToAmount(quote.outAmount, safeParams.toToken)
    const priceImpact = Number(quote.priceImpactPct) || 0
    const route = routeLabels(quote)
    const fee = estimateRouteFee(quote, safeParams.fromToken)
    const swapId = randomUUID()

    const pending: PendingSwap = {
      id: swapId,
      fromToken: safeParams.fromToken.toUpperCase(),
      toToken: safeParams.toToken.toUpperCase(),
      inputAmount: safeParams.amount,
      expectedOutput,
      priceImpact,
      fee,
      route,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }

    const stored: StoredSwap = {
      pending,
      quote,
      walletAddress: safeParams.walletAddress,
      createdAt: new Date().toISOString()
    }

    if (!safeParams.quoteOnly) {
      await getRedis().set(`swap:${swapId}`, JSON.stringify(stored), 'EX', 5 * 60)
    }

    const warning =
      safeParams.amount >= 500
        ? '\n\n*Note:* This is over 500 units. Double-check price impact and expected output before confirming.'
        : ''

    const quoteTable = formatFixedTable(
      ['Item', 'Value'],
      [
        ['Send', formatTokenAmount(safeParams.amount, safeParams.fromToken)],
        ['Receive', `~${formatTokenAmount(expectedOutput, safeParams.toToken)}`],
        ['Impact', `${(priceImpact * 100).toFixed(2)}%`],
        ['Fee', formatTokenAmount(fee, safeParams.fromToken)]
      ]
    )

    const text = [
      '*Swap Quote*',
      '',
      '```',
      quoteTable,
      '```',
      '',
      `Route: ${route.length > 0 ? route.join(' -> ') : 'Jupiter best route'}`,
      '',
      safeParams.quoteOnly
        ? 'Quote only. Nothing is executable from this message.'
        : 'Ready to execute? This expires in 5 minutes.',
      warning
    ].join('\n')

    return {
      kind: 'pending_swap',
      swapId,
      details: pending,
      pendingActionId: safeParams.quoteOnly ? undefined : swapId,
      text,
      inlineKeyboard: safeParams.quoteOnly ? undefined : confirmationKeyboard(swapId)
    }
  } catch (error) {
    logger.error({ error, params }, 'Prepare swap failed')
    throw new Error('I could not prepare that swap quote. Please check the token and amount, then try again.')
  }
}

export async function executeSwap(swapId: string, walletAddress: string): Promise<{ signature: string; status: string }> {
  try {
    logger.info({ swapId, walletAddress }, 'Executing confirmed swap')
    if (!validateSolanaAddress(walletAddress)) {
      throw new Error('Invalid wallet address')
    }

    const raw = await getRedis().get(`swap:${swapId}`)
    if (!raw) {
      throw new Error('Swap preview expired')
    }

    const stored = JSON.parse(raw) as StoredSwap
    if (stored.walletAddress !== walletAddress) {
      throw new Error('Swap wallet mismatch')
    }

    // Transaction execution is intentionally separated from quote preparation.
    // The quote is stored with a short TTL, then rebuilt only after the user taps Confirm.
    const built = await buildSwapTransaction(stored.quote, walletAddress)
    const signature = await signAndSendWithPhantom(built.swapTransaction)
    const status = await waitForConfirmation(signature)

    await getRedis().del(`swap:${swapId}`)
    return { signature, status }
  } catch (error) {
    logger.error({ error, swapId, walletAddress }, 'Execute swap failed')
    throw error
  }
}

export async function cancelSwap(swapId: string): Promise<void> {
  try {
    await getRedis().del(`swap:${swapId}`)
  } catch (error) {
    logger.error({ error, swapId }, 'Failed to cancel swap')
  }
}

export async function getPendingSwap(swapId: string): Promise<PendingSwap | undefined> {
  try {
    const raw = await getRedis().get(`swap:${swapId}`)
    if (!raw) return undefined

    const stored = JSON.parse(raw) as StoredSwap
    return stored.pending
  } catch (error) {
    logger.error({ error, swapId }, 'Failed to fetch pending swap')
    return undefined
  }
}

function confirmationKeyboard(swapId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: 'Confirm ✅', callback_data: `confirm:swap:${swapId}` },
        { text: 'Cancel ❌', callback_data: `cancel:swap:${swapId}` }
      ]
    ]
  }
}

function estimateRouteFee(quote: QuoteResponse, fromToken: string): number {
  try {
    const feeAtoms = quote.routePlan.reduce((sum, route) => {
      const fee = Number(route.swapInfo.feeAmount ?? 0)
      return sum + (Number.isFinite(fee) ? fee : 0)
    }, 0)

    return atomicToAmount(feeAtoms.toString(), fromToken)
  } catch (error) {
    logger.warn({ error }, 'Failed to estimate swap fee')
    return 0
  }
}
