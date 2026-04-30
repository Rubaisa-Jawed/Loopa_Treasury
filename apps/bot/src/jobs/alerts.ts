import { Queue, Worker, type JobsOptions } from 'bullmq'
import type { Bot } from 'grammy'
import type { PilotContext } from '../bot/context.js'
import { getActiveAlerts, getUserById, markAlertTriggered } from '../db/queries.js'
import { getTokenPrice } from '../agent/tools/price.js'
import { formatUsd } from '../utils/format.js'
import { getRedis } from '../utils/redis.js'
import { logger } from '../utils/logger.js'

const QUEUE_NAME = 'pilot-alerts'

export function startAlertWorkers(bot: Bot<PilotContext>): Worker[] {
  const connection = getRedis()
  const queue = new Queue(QUEUE_NAME, { connection })
  const options: JobsOptions = {
    removeOnComplete: 20,
    removeOnFail: 50
  }

  queue
    .add('price-alerts', {}, { ...options, repeat: { every: 5 * 60 * 1000 } })
    .catch((error: unknown) => logger.error({ error }, 'Failed to schedule price alert job'))

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      try {
        if (job.name === 'price-alerts') {
          await runPriceAlerts(bot)
        }
      } catch (error) {
        logger.error({ error, jobName: job.name }, 'Price alert job failed')
        throw error
      }
    },
    { connection }
  )

  worker.on('failed', (job, error) => {
    logger.error({ error, jobId: job?.id, jobName: job?.name }, 'Alert worker job failed')
  })

  return [worker]
}

async function runPriceAlerts(bot: Bot<PilotContext>): Promise<void> {
  try {
    const alerts = await getActiveAlerts()

    for (const alert of alerts) {
      try {
        if (!alert.userId) continue

        const user = await getUserById(alert.userId)
        if (!user) continue

        const price = await getTokenPrice(alert.token)
        const threshold = Number(alert.threshold)
        const triggered =
          alert.direction === 'below' ? price.usdPrice <= threshold : price.usdPrice >= threshold

        if (!triggered) continue

        await bot.api.sendMessage(
          user.telegramId,
          [
            '*Price alert triggered*',
            '',
            `${alert.token.toUpperCase()} is now *${formatUsd(price.usdPrice)}*`,
            `Your alert was ${alert.direction} ${formatUsd(threshold)}.`
          ].join('\n'),
          { parse_mode: 'Markdown' }
        )
        await markAlertTriggered(alert.id)
      } catch (error) {
        logger.error({ error, alertId: alert.id }, 'Failed to process alert')
      }
    }
  } catch (error) {
    logger.error({ error }, 'Price alert runner failed')
  }
}
