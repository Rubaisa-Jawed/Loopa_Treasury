import { TOKEN_DECIMALS, TOKEN_MINTS, tokenSymbolToMint } from '@pilot/shared'
import { env } from '../utils/env.js'
import { fetchJson, asNumber, asRecord } from '../utils/http.js'
import { logger } from '../utils/logger.js'

export interface JupiterSwapInfo {
  ammKey: string
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  label?: string
  feeAmount?: string
  feeMint?: string
}

export interface JupiterRoutePlan {
  swapInfo: JupiterSwapInfo
  percent: number
  bps?: number
}

export interface QuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: JupiterRoutePlan[]
  platformFee?: {
    amount: string
    feeBps: number
  }
  contextSlot?: number
  timeTaken?: number
}

interface SwapBuildResponse {
  swapTransaction: string
  lastValidBlockHeight?: number
  prioritizationFeeLamports?: number
}

interface PriceResponseV3 {
  [mint: string]: {
    usdPrice?: number
    price?: number
  }
}

export function amountToAtomic(amount: number, symbolOrMint: string): string {
  const decimals = decimalsForToken(symbolOrMint)
  const atomic = Math.round(amount * 10 ** decimals)
  return atomic.toString()
}

export function atomicToAmount(amount: string, symbolOrMint: string): number {
  const decimals = decimalsForToken(symbolOrMint)
  return Number(amount) / 10 ** decimals
}

export function decimalsForToken(symbolOrMint: string): number {
  const normalized = symbolOrMint.trim().toUpperCase()
  if (normalized === 'SOL') return TOKEN_DECIMALS.SOL
  if (normalized === 'USDC') return TOKEN_DECIMALS.USDC
  if (normalized === 'USDT') return TOKEN_DECIMALS.USDT
  if (normalized === 'MSOL') return TOKEN_DECIMALS.MSOL
  if (symbolOrMint === TOKEN_MINTS.SOL) return TOKEN_DECIMALS.SOL
  if (symbolOrMint === TOKEN_MINTS.USDC) return TOKEN_DECIMALS.USDC
  if (symbolOrMint === TOKEN_MINTS.USDT) return TOKEN_DECIMALS.USDT
  if (symbolOrMint === TOKEN_MINTS.MSOL) return TOKEN_DECIMALS.MSOL

  return 6
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 50
): Promise<QuoteResponse> {
  try {
    const url = new URL(`${env.JUPITER_API_URL.replace(/\/$/, '')}/quote`)
    url.searchParams.set('inputMint', inputMint)
    url.searchParams.set('outputMint', outputMint)
    url.searchParams.set('amount', amount)
    url.searchParams.set('slippageBps', slippageBps.toString())

    const response = await fetchJson<QuoteResponse>(url.toString())
    logger.info(
      {
        inputMint,
        outputMint,
        inAmount: response.inAmount,
        outAmount: response.outAmount,
        priceImpactPct: response.priceImpactPct
      },
      'Fetched Jupiter quote'
    )
    return response
  } catch (error) {
    logger.error({ error, inputMint, outputMint, amount }, 'Failed to fetch Jupiter quote')
    throw error
  }
}

export async function buildSwapTransaction(quoteResponse: QuoteResponse, userPublicKey: string): Promise<SwapBuildResponse> {
  try {
    const url = `${env.JUPITER_API_URL.replace(/\/$/, '')}/swap`
    return await fetchJson<SwapBuildResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      })
    })
  } catch (error) {
    logger.error({ error, userPublicKey }, 'Failed to build Jupiter swap transaction')
    throw error
  }
}

export async function getTokenPrice(token: string): Promise<number> {
  try {
    const mint = tokenSymbolToMint(token)
    const url = new URL('https://lite-api.jup.ag/price/v3')
    url.searchParams.set('ids', mint)

    const response = await fetchJson<PriceResponseV3>(url.toString())
    const direct = response[mint]?.usdPrice ?? response[mint]?.price

    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return direct
    }

    const record = asRecord(response[mint])
    const flexiblePrice = asNumber(record?.usdPrice ?? record?.price ?? record?.priceUsd)
    if (flexiblePrice !== undefined) {
      return flexiblePrice
    }

    return 0
  } catch (error) {
    logger.error({ error, token }, 'Failed to fetch token price')
    return 0
  }
}

export function routeLabels(quote: QuoteResponse): string[] {
  return quote.routePlan.map((route) => route.swapInfo.label ?? route.swapInfo.ammKey).filter(Boolean)
}
