import type { DeFiPosition, RiskAppetite, YieldOpportunity } from '@pilot/shared'
import { tokenSymbolToMint } from '@pilot/shared'
import { asNumber, asRecord, asString, fetchJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import { passesRisk, riskForTvl } from './kamino.js'

interface RaydiumEnvelope {
  success?: boolean
  data?: unknown
}

export async function getRaydiumYield(token: string, riskAppetite: RiskAppetite): Promise<YieldOpportunity[]> {
  try {
    const mint = tokenSymbolToMint(token)
    const url = new URL('https://api-v3.raydium.io/pools/info/mint')
    url.searchParams.set('mint1', mint)
    url.searchParams.set('poolType', 'all')
    url.searchParams.set('poolSortField', 'liquidity')
    url.searchParams.set('sortType', 'desc')
    url.searchParams.set('pageSize', '20')
    url.searchParams.set('page', '1')

    const response = await fetchJson<RaydiumEnvelope>(url.toString()).catch((error: unknown) => {
      logger.warn({ error, mint }, 'Raydium pool API failed')
      return undefined
    })

    const records = collectRecords(response?.data)

    return records
      .map((pool) => {
        const tvl = asNumber(pool.tvl ?? pool.liquidity ?? pool.liquidityUsd) ?? 0
        const day = asRecord(pool.day)
        const apy = asNumber(pool.apr24h ?? pool.apr7d ?? pool.apr30d ?? day?.apr) ?? 0
        const name = asString(pool.name ?? pool.poolName) ?? 'Raydium pool'
        const risk = riskForTvl(tvl)

        return {
          protocol: 'Raydium',
          type: 'lp' as const,
          apy,
          tvl,
          risk,
          description: `Provide liquidity to ${name}. LP yield can include trading fees and incentives.`,
          actionLabel: `Open ${name}`
        }
      })
      .filter((opportunity) => opportunity.apy > 0 && opportunity.tvl > 0 && passesRisk(opportunity.risk, riskAppetite))
      .slice(0, 3)
  } catch (error) {
    logger.error({ error, token, riskAppetite }, 'Failed to fetch Raydium yield')
    return []
  }
}

export async function getRaydiumPositions(_walletAddress: string): Promise<DeFiPosition[]> {
  try {
    // Raydium CLMM/CPMM positions require decoding owner NFTs and LP token accounts.
    // This placeholder keeps the interface production-ready while the read path is extended.
    return []
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Raydium positions')
    return []
  }
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectRecords)
  }

  const record = asRecord(value)
  if (!record) return []

  const nested = Object.values(record).flatMap(collectRecords)
  if (record.id || record.poolId || record.tvl || record.liquidity) {
    return [record, ...nested]
  }

  return nested
}
