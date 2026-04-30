import type { InlineKeyboardMarkup } from 'grammy/types'
import type { InlineKeyboard as SharedInlineKeyboard } from '@pilot/shared'
import type { PilotContext } from './context.js'
import { logger } from '../utils/logger.js'
import { truncateTelegramMessage } from '../utils/format.js'

type ReplyOptions = NonNullable<Parameters<PilotContext['reply']>[1]>

export async function replyMarkdown(ctx: PilotContext, text: string, options: ReplyOptions = {}): Promise<void> {
  try {
    for (const chunk of truncateTelegramMessage(text)) {
      await ctx.reply(chunk, { parse_mode: 'Markdown', ...options })
    }
  } catch (error) {
    logger.warn({ error }, 'Markdown reply failed; retrying as plain text')
    try {
      for (const chunk of truncateTelegramMessage(text)) {
        await ctx.reply(chunk, options)
      }
    } catch (retryError) {
      logger.error({ error: retryError }, 'Plain text reply failed')
    }
  }
}

export async function answerCallback(ctx: PilotContext, text?: string): Promise<void> {
  try {
    await ctx.answerCallbackQuery(text ? { text } : undefined)
  } catch (error) {
    logger.warn({ error }, 'Failed to answer callback query')
  }
}

export function toGrammyInlineKeyboard(keyboard: SharedInlineKeyboard | undefined): InlineKeyboardMarkup | undefined {
  if (!keyboard) {
    return undefined
  }

  return {
    inline_keyboard: keyboard.inline_keyboard.map((row) =>
      row.map((button) => {
        if (button.callback_data) {
          return { text: button.text, callback_data: button.callback_data }
        }

        if (button.url) {
          return { text: button.text, url: button.url }
        }

        if (button.web_app) {
          return { text: button.text, web_app: button.web_app }
        }

        return { text: button.text, callback_data: 'noop' }
      })
    )
  }
}
