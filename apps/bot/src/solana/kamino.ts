import type { DeFiPosition, RiskAppetite, YieldOpportunity } from '@pilot/shared'
import { TOKEN_MINTS, tokenSymbolToMint } from '@pilot/shared'
import { asNumber, asRecord, asString, fetchJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'

const KAMINO_API = 'https://api.kamino.finance'

export async function getKaminoYield(token: string, riskAppetite: RiskAppetite): Promise<YieldOpportunity[]> {
  try {
    const mint = tokenSymbolToMint(token)
    const response = await fetchJson<unknown>(`${KAMINO_API}/v2/kamino-market`).catch((error: unknown) => {
      logger.warn({ error }, 'Kamino market API failed')
      return undefined
    })

    const reserves = collectRecords(response).filter((record) => {
      const reserveMint = asString(record.mintAddress ?? record.liquidityMint ?? record.tokenMint ?? record.mint)
      const symbol = asString(record.symbol ?? record.tokenSymbol ?? record.asset)
      return reserveMint === mint || symbol?.toUpperCase() === token.toUpperCase()
    })

    const opportunities = reserves
      .map((reserve) => {
        const apy =
          asNumber(reserve.supplyApy ?? reserve.depositApy ?? reserve.apy ?? reserve.totalSupplyAPY ?? reserve.lendingApy) ??
          0
        const tvl = asNumber(reserve.tvl ?? reserve.totalLiquidityUsd ?? reserve.liquidityUsd ?? reserve.totalDepositsUsd) ?? 0
        const symbol = asString(reserve.symbol ?? reserve.tokenSymbol ?? reserve.asset) ?? token.toUpperCase()

        return {
          protocol: 'Kamino',
          type: 'lending' as const,
          apy: normalizeApy(apy),
          tvl,
          risk: riskForTvl(tvl),
          description: `Supply ${symbol} into a Kamino lending market and earn variable lending yield.`,
          actionLabel: `Deposit ${symbol} on Kamino`
        }
      })
      .filter((opportunity) => opportunity.apy > 0 && passesRisk(opportunity.risk, riskAppetite))
      .sort((a, b) => b.tvl - a.tvl || b.apy - a.apy)
      .slice(0, 3)

    return opportunities
  } catch (error) {
    logger.error({ error, token, riskAppetite }, 'Failed to fetch Kamino yield')
    return []
  }
}

export async function getKaminoPositions(walletAddress: string): Promise<DeFiPosition[]> {
  try {
    const response = await fetchJson<unknown>(`${KAMINO_API}/kvaults/users/${walletAddress}/positions`).catch(
      (error: unknown) => {
        logger.debug({ error, walletAddress }, 'No Kamino vault positions found')
        return undefined
      }
    )

    return collectRecords(response)
      .map((record) => {
        const currentValue = asNumber(record.currentValueUsd ?? record.valueUsd ?? record.netValueUsd) ?? 0
        const depositedValue = asNumber(record.depositedValueUsd ?? record.depositedUsd ?? record.valueUsd) ?? currentValue
        const apy = normalizeApy(asNumber(record.apy ?? record.supplyApy ?? record.vaultApy) ?? 0)
        const poolName = asString(record.vaultName ?? record.marketName ?? record.name) ?? 'Kamino position'

        return {
          protocol: 'kamino' as const,
          type: 'lending' as const,
          poolName,
          depositedValue,
          currentValue,
          earnedYield: Math.max(0, currentValue - depositedValue),
          apy
        }
      })
      .filter((position) => position.currentValue > 0)
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to fetch Kamino positions')
    return []
  }
}

export function riskForTvl(tvl: number): 'low' | 'medium' | 'high' {
  if (tvl >= 10_000_000) return 'low'
  if (tvl >= 1_000_000) return 'medium'
  return 'high'
}

export function passesRisk(risk: 'low' | 'medium' | 'high', appetite: RiskAppetite): boolean {
  if (appetite === 'aggressive') return true
  if (appetite === 'balanced') return risk !== 'high'
  return risk === 'low'
}

function normalizeApy(value: number): number {
  return value > 0 && value < 1 ? value * 100 : value
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = []
  const visit = (entry: unknown): void => {
    const record = asRecord(entry)
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item)
      return
    }

    if (!record) return
    if (
      record.mintAddress ||
      record.liquidityMint ||
      record.tokenMint ||
      record.supplyApy ||
      record.depositApy ||
      record.currentValueUsd ||
      record.valueUsd
    ) {
      output.push(record)
    }

    for (const item of Object.values(record)) {
      if (typeof item === 'object' && item !== null) {
        visit(item)
      }
    }
  }

  visit(value)

  if (output.length === 0 && tokenSymbolToMint('SOL') === TOKEN_MINTS.SOL) {
    return []
  }

  return output
}
