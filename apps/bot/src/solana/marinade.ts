import type { DeFiPosition, YieldOpportunity } from '@pilot/shared'
import { TOKEN_MINTS } from '@pilot/shared'
import { asNumber, asRecord, fetchJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import { getTokenPrice } from './jupiter.js'

export async function getMarinadeYield(token: string): Promise<YieldOpportunity[]> {
  try {
    const normalized = token.toUpperCase()
    if (normalized !== 'SOL' && token !== TOKEN_MINTS.SOL) {
      return []
    }

    const apy = await fetchMarinadeApy()
    return [
      {
        protocol: 'Marinade',
        type: 'staking',
        apy,
        tvl: 0,
        risk: 'low',
        description: 'Liquid stake SOL for mSOL while keeping DeFi composability.',
        actionLabel: 'Stake SOL with Marinade'
      }
    ]
  } catch (error) {
    logger.error({ error, token }, 'Failed to fetch Marinade yield')
    return []
  }
}

export async function getMarinadePositions(walletAddress: string): Promise<DeFiPosition[]> {
  try {
    const response = await fetchJson<unknown>(`https://api.marinade.finance/v1/portfolio/${walletAddress}`).catch(
      (error: unknown) => {
        logger.debug({ error, walletAddress }, 'No Marinade portfolio data found')
        return undefined
      }
    )

    const record = asRecord(response)
    const msolBalance = asNumber(record?.msolBalance ?? record?.mSolBalance ?? record?.liquidStakeBalance) ?? 0
    if (msolBalance <= 0) {
      return []
    }

    const solPrice = await getTokenPrice('SOL')
    const apy = await fetchMarinadeApy()
    const currentValue = msolBalance * solPrice

    return [
      {
        protocol: 'marinade',
        type: 'staking',
        poolName: 'mSOL liquid staking',
        depositedValue: currentValue,
        currentValue,
        earnedYield: 0,
        apy
      }
    ]
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to fetch Marinade positions')
    return []
  }
}

async function fetchMarinadeApy(): Promise<number> {
  try {
    const response = await fetchJson<unknown>('https://api.marinade.finance/msol/apy').catch((error: unknown) => {
      logger.warn({ error }, 'Marinade APY endpoint failed; using documented conservative estimate')
      return undefined
    })

    const record = asRecord(response)
    const apy = asNumber(record?.apy ?? record?.value ?? record?.msolApy)

    if (apy !== undefined && apy > 0) {
      return apy > 0 && apy < 1 ? apy * 100 : apy
    }

    return 7
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Marinade APY')
    return 7
  }
}
