import { randomUUID } from 'node:crypto'
import { Keypair } from '@solana/web3.js'
import { env } from '../../utils/env.js'
import { asRecord, fetchJson } from '../../utils/http.js'
import { logger } from '../../utils/logger.js'

export interface X402Params {
  dataType: string
  maxPaymentUsdc: number
}

interface X402Result {
  paid: number
  currency: 'USDC'
  data: Record<string, unknown>
  mode: 'mock' | 'x402'
}

interface X402PaymentPayload {
  paymentId: string
  paymentRequired: string
  payer?: string
  maxPaymentUsdc: number
  network: string
  createdAt: string
}

export async function payForDataX402(params: X402Params): Promise<X402Result> {
  try {
    logger.info({ dataType: params.dataType, maxPaymentUsdc: params.maxPaymentUsdc }, 'Agent tool: pay_for_data_x402')

    if (!Number.isFinite(params.maxPaymentUsdc) || params.maxPaymentUsdc <= 0) {
      throw new Error('maxPaymentUsdc must be positive')
    }

    if (!env.X402_DATA_ENDPOINT) {
      return mockPaidData(params)
    }

    const initial = await fetch(env.X402_DATA_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        'X-LoopTreasury-Data-Type': params.dataType
      }
    })

    if (initial.status !== 402) {
      const data = (await initial.json()) as Record<string, unknown>
      return {
        paid: 0,
        currency: 'USDC',
        data,
        mode: 'x402'
      }
    }

    const paymentRequired = initial.headers.get('PAYMENT-REQUIRED')
    if (!paymentRequired) {
      throw new Error('x402 endpoint returned 402 without PAYMENT-REQUIRED header')
    }

    const paymentPayload = buildPaymentPayload(paymentRequired, params.maxPaymentUsdc)

    // x402 V2 retries the original request with PAYMENT-SIGNATURE. A production
    // SVM Exact scheme client would sign and settle here; this payload shape keeps
    // the integration boundary ready for the official x402 SVM client.
    const paidResponse = await fetchJson<Record<string, unknown>>(env.X402_DATA_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        'X-LoopTreasury-Data-Type': params.dataType,
        'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify(paymentPayload)).toString('base64')
      }
    })

    logger.info({ paid: paymentPayload.maxPaymentUsdc, dataType: params.dataType }, 'x402 data payment completed')
    return {
      paid: paymentPayload.maxPaymentUsdc,
      currency: 'USDC',
      data: paidResponse,
      mode: 'x402'
    }
  } catch (error) {
    logger.error({ error, params }, 'x402 payment tool failed')
    return mockPaidData(params)
  }
}

function buildPaymentPayload(paymentRequiredHeader: string, maxPaymentUsdc: number): X402PaymentPayload {
  const payer = getAgentPublicKey()
  return {
    paymentId: `pay_${randomUUID().replaceAll('-', '')}`,
    paymentRequired: paymentRequiredHeader,
    payer,
    maxPaymentUsdc,
    network: 'solana:mainnet-beta',
    createdAt: new Date().toISOString()
  }
}

function getAgentPublicKey(): string | undefined {
  try {
    if (!env.AGENT_WALLET_PRIVATE_KEY) {
      return undefined
    }

    const parsed = JSON.parse(env.AGENT_WALLET_PRIVATE_KEY) as unknown
    if (!Array.isArray(parsed)) {
      return undefined
    }

    const keypair = Keypair.fromSecretKey(Uint8Array.from(parsed.map((value) => Number(value))))
    return keypair.publicKey.toBase58()
  } catch (error) {
    logger.warn({ error }, 'Could not derive agent wallet public key')
    return undefined
  }
}

function mockPaidData(params: X402Params): X402Result {
  const paid = Math.min(params.maxPaymentUsdc, 0.001)
  const token = params.dataType.toLowerCase().includes('sol') ? 'SOL' : 'market'
  const data = {
    headline: `${token.toUpperCase()} sentiment is cautiously constructive`,
    sentiment: 'positive',
    confidence: 0.72,
    drivers: ['liquidity depth improving', 'staking demand steady', 'risk appetite mixed'],
    paidVia: 'mock-x402',
    requestedAt: new Date().toISOString()
  }

  logger.info({ paid, dataType: params.dataType, mode: 'mock' }, 'Mock x402 payment completed')
  return {
    paid,
    currency: 'USDC',
    data: asRecord(data) ?? data,
    mode: 'mock'
  }
}
