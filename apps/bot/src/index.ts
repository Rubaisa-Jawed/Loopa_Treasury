import { createServer, type Server } from 'node:http'
import { Bot, session, webhookCallback } from 'grammy'
import { closeDb } from './db/schema.js'
import { startCommand } from './bot/commands/start.js'
import { portfolioCommand } from './bot/commands/portfolio.js'
import { helpCommand } from './bot/commands/help.js'
import { settingsCommand } from './bot/commands/settings.js'
import { phantomCommand } from './bot/commands/phantom.js'
import { messageHandler, webAppDataHandler } from './bot/handlers/message.js'
import { callbackHandler } from './bot/handlers/callback.js'
import { authMiddleware } from './bot/middleware/auth.js'
import { rateLimitMiddleware } from './bot/middleware/rateLimit.js'
import { initialSession, type PilotContext } from './bot/context.js'
import { startMonitoringWorkers } from './jobs/monitor.js'
import { startAlertWorkers } from './jobs/alerts.js'
import { closeRedis } from './utils/redis.js'
import { env } from './utils/env.js'
import { logger } from './utils/logger.js'
import { closePhantomMcp } from './agent/mcp/phantom.js'

const bot = new Bot<PilotContext>(env.TELEGRAM_BOT_TOKEN)
const workers = [...startMonitoringWorkers(bot), ...startAlertWorkers(bot)]
let server: Server | undefined

bot.use(session({ initial: initialSession }))
bot.use(rateLimitMiddleware(30, 10 * 60))
bot.use(authMiddleware)

bot.command('start', startCommand)
bot.command('portfolio', portfolioCommand)
bot.command('help', helpCommand)
bot.command('settings', settingsCommand)
bot.command('phantom', phantomCommand)
bot.on('message:web_app_data', webAppDataHandler)
bot.on('message:text', messageHandler)
bot.on('callback_query:data', callbackHandler)

bot.catch((error) => {
  logger.error({ error }, 'Unhandled Grammy bot error')
})

async function main(): Promise<void> {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Start LoopTreasury onboarding' },
      { command: 'portfolio', description: 'Show your Solana portfolio' },
      { command: 'settings', description: 'Update LoopTreasury preferences' },
      { command: 'phantom', description: 'Connect Phantom agent wallet' },
      { command: 'help', description: 'Show examples and commands' }
    ])

    if (env.NODE_ENV === 'production' && env.TELEGRAM_WEBHOOK_URL) {
      await bot.api.setWebhook(env.TELEGRAM_WEBHOOK_URL, {
        secret_token: env.TELEGRAM_WEBHOOK_SECRET || undefined,
        allowed_updates: ['message', 'callback_query']
      })

      const callback = webhookCallback(bot, 'http', {
        secretToken: env.TELEGRAM_WEBHOOK_SECRET || undefined
      })
      server = createServer(callback)
      const port = Number(process.env.PORT ?? 3000)
      server.listen(port, () => {
        logger.info({ port }, 'LoopTreasury bot listening for Telegram webhooks')
      })
      return
    }

    logger.info('LoopTreasury bot starting in long polling mode')
    await bot.start({
      allowed_updates: ['message', 'callback_query']
    })
  } catch (error) {
    logger.error({ error }, 'LoopTreasury startup failed')
    await shutdown('startup_error')
  }
}

async function shutdown(signal: string): Promise<void> {
  try {
    logger.info({ signal }, 'Shutting down LoopTreasury bot')
    bot.stop()

    await Promise.all(workers.map((worker) => worker.close()))
    await closePhantomMcp()
    await closeRedis()
    await closeDb()

    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve())
      })
    }
  } catch (error) {
    logger.error({ error }, 'Graceful shutdown failed')
  } finally {
    if (signal !== 'startup_error') {
      process.exit(0)
    }
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT')
})

process.once('SIGTERM', () => {
  void shutdown('SIGTERM')
})

void main()
