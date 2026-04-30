import type { Portfolio } from '@pilot/shared'
import { fetchPortfolio } from '../../solana/portfolio.js'
import { logger } from '../../utils/logger.js'

export async function getPortfolioBalances(walletAddress: string): Promise<Portfolio> {
  try {
    logger.info({ walletAddress }, 'Agent tool: get_portfolio_balances')
    return await fetchPortfolio(walletAddress)
  } catch (error) {
    logger.error({ error, walletAddress }, 'Portfolio tool failed')
    throw new Error('I could not fetch that portfolio right now. Please try again.')
  }
}
