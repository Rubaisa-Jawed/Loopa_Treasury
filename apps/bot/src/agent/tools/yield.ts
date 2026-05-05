import type { RiskAppetite, YieldOpportunity } from '@pilot/shared'
import { getKaminoYield } from '../../solana/kamino.js'
import { getMarinadeYield } from '../../solana/marinade.js'
import { getRaydiumYield } from '../../solana/raydium.js'
import { logger } from '../../utils/logger.js'
import { parseYieldSearchInput } from './validation.js'

export interface YieldParams {
  token: string
  amount?: number
  riskAppetite: RiskAppetite
}

export async function getYieldOpportunities(params: YieldParams): Promise<YieldOpportunity[]> {
  try {
    const safeParams = parseYieldSearchInput(params)
    logger.info({ token: safeParams.token, riskAppetite: safeParams.riskAppetite }, 'Agent tool: get_yield_opportunities')
    const [kamino, raydium, marinade] = await Promise.all([
      getKaminoYield(safeParams.token, safeParams.riskAppetite),
      getRaydiumYield(safeParams.token, safeParams.riskAppetite),
      getMarinadeYield(safeParams.token)
    ])

    return [...kamino, ...raydium, ...marinade]
      .sort((a, b) => scoreOpportunity(b) - scoreOpportunity(a))
      .slice(0, 3)
  } catch (error) {
    logger.error({ error, params }, 'Yield tool failed')
    return []
  }
}

function scoreOpportunity(opportunity: YieldOpportunity): number {
  const riskPenalty = opportunity.risk === 'low' ? 1 : opportunity.risk === 'medium' ? 1.5 : 2.5
  const tvlBoost = Math.log10(Math.max(opportunity.tvl, 1)) / 10
  return opportunity.apy / riskPenalty + tvlBoost
}
