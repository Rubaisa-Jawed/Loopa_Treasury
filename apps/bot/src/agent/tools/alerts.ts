import { createAlert } from '../../db/queries.js'
import { logger } from '../../utils/logger.js'

export interface SetPriceAlertParams {
  token: string
  threshold: number
  direction: 'above' | 'below'
  userId: number
}

export async function setPriceAlert(params: SetPriceAlertParams): Promise<{ ok: boolean; message: string }> {
  try {
    logger.info(
      { token: params.token, threshold: params.threshold, direction: params.direction, userId: params.userId },
      'Agent tool: set_price_alert'
    )
    const type = params.direction === 'above' ? 'price_above' : 'price_below'
    const alert = await createAlert(params.userId, type, params.token, params.threshold, params.direction)

    if (!alert) {
      return { ok: false, message: 'I could not save that alert yet. Please try again.' }
    }

    return {
      ok: true,
      message: `Alert set: ${params.token.toUpperCase()} ${params.direction} ${params.threshold}.`
    }
  } catch (error) {
    logger.error({ error, params }, 'Set price alert tool failed')
    return { ok: false, message: 'I could not set that alert yet. Please try again.' }
  }
}
