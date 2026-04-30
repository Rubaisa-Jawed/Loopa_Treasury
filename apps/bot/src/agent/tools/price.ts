import { getTokenPrice as fetchTokenPrice } from '../../solana/jupiter.js'
import { logger } from '../../utils/logger.js'

export async function getTokenPrice(token: string): Promise<{ token: string; usdPrice: number }> {
  try {
    logger.info({ token }, 'Agent tool: get_token_price')
    const usdPrice = await fetchTokenPrice(token)
    return { token, usdPrice }
  } catch (error) {
    logger.error({ error, token }, 'Token price tool failed')
    return { token, usdPrice: 0 }
  }
}
