import { Queue, Worker, type JobsOptions } from 'bullmq'
import type { Bot } from 'grammy'
import type { PilotContext } from '../bot/context.js'
import { getUsersWithWallets } from '../db/queries.js'
import { getPortfolioBalances } from '../agent/tools/portfolio.js'
import { formatPortfolioMessage, formatUsd } from '../utils/format.js'
import { getRedis } from '../utils/redis.js'
import { logger } from '../utils/logger.js'

const QUEUE_NAME = 'pilot-monitoring'

export function startMonitoringWorkers(bot: Bot<PilotContext>): Worker[] {
  const connection = getRedis()
  const queue = new Queue(QUEUE_NAME, { connection })
  const options: JobsOptions = {
    removeOnComplete: 20,
    removeOnFail: 50
  }

  queue
    .add('portfolio-monitor', {}, { ...options, repeat: { every: 4 * 60 * 60 * 1000 } })
    .catch((error: unknown) => logger.error({ error }, 'Failed to schedule portfolio monitor job'))
  queue
    .add('daily-summary', {}, { ...options, repeat: { pattern: '0 8 * * *' } })
    .catch((error: unknown) => logger.error({ error }, 'Failed to schedule daily summary job'))

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      try {
        if (job.name === 'portfolio-monitor') {
          await runPortfolioMonitor(bot)
        }

        if (job.name === 'daily-summary') {
          await runDailySummary(bot)
        }
      } catch (error) {
        logger.error({ error, jobName: job.name }, 'Monitoring job failed')
        throw error
      }
    },
    { connection }
  )

  worker.on('failed', (job, error) => {
    logger.error({ error, jobId: job?.id, jobName: job?.name }, 'Monitoring worker job failed')
  })

  return [worker]
}

async function runPortfolioMonitor(bot: Bot<PilotContext>): Promise<void> {
  try {
    const redis = getRedis()
    const users = await getUsersWithWallets()

    for (const user of users) {
      if (!user.walletAddress || !user.largeMovesEnabled) continue

      try {
        const portfolio = await getPortfolioBalances(user.walletAddress)
        const key = `snapshot:portfolio:${user.id}`
        const previous = await redis.get(key)
        const previousValue = previous ? Number(JSON.parse(previous) as number) : undefined

        if (previousValue && previousValue > 0) {
          const change = (portfolio.totalUsdValue - previousValue) / previousValue
          if (Math.abs(change) >= 0.05) {
            await bot.api.sendMessage(
              user.telegramId,
              [
                '*Portfolio move detected*',
                '',
                `Current value: *${formatUsd(portfolio.totalUsdValue)}*`,
                `Change since last check: *${(change * 100).toFixed(2)}%*`,
                '',
                'Use /portfolio for the latest breakdown.'
              ].join('\n'),
              { parse_mode: 'Markdown' }
            )
          }
        }

        await redis.set(key, JSON.stringify(portfolio.totalUsdValue), 'EX', 7 * 24 * 60 * 60)
      } catch (error) {
        logger.error({ error, userId: user.id }, 'Portfolio monitor failed for user')
      }
    }
  } catch (error) {
    logger.error({ error }, 'Portfolio monitor failed')
  }
}

async function runDailySummary(bot: Bot<PilotContext>): Promise<void> {
  try {
    const users = await getUsersWithWallets()

    for (const user of users) {
      if (!user.walletAddress || !user.dailySummaryEnabled) continue

      try {
        const portfolio = await getPortfolioBalances(user.walletAddress)
        await bot.api.sendMessage(user.telegramId, formatPortfolioMessage(portfolio), {
          parse_mode: 'Markdown'
        })
      } catch (error) {
        logger.error({ error, userId: user.id }, 'Daily summary failed for user')
      }
    }
  } catch (error) {
    logger.error({ error }, 'Daily summary failed')
  }
}
