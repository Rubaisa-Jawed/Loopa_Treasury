import { anthropic } from '@ai-sdk/anthropic'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import type { AgentResponse, InlineKeyboard, RiskAppetite } from '@pilot/shared'
import type { Conversation, User } from '../db/schema.js'
import { logger } from '../utils/logger.js'
import { asRecord, asString } from '../utils/http.js'
import { env } from '../utils/env.js'
import { SYSTEM_PROMPT } from './prompt.js'
import * as tools from './tools/index.js'

export interface AgentInput {
  message: string
  history: Conversation[]
  user: User
}

interface AgentTextResult {
  text: string
  toolResults?: unknown[]
  steps?: Array<{
    toolResults?: unknown[]
  }>
}

export async function runAgent({ message, history, user }: AgentInput): Promise<AgentResponse> {
  try {
    const riskAppetite = normalizeRisk(user.riskAppetite)
    const prompt = [
      {
        role: 'user' as const,
        content: [
          'User context for this chat:',
          `- userId: ${user.id}`,
          `- walletAddress: ${user.walletAddress ?? 'not connected'}`,
          `- riskAppetite: ${riskAppetite}`,
          '',
          'Use this context for tool calls. Never ask the user for their userId.'
        ].join('\n')
      },
      ...history.map((entry) => ({
        role: entry.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: entry.content
      })),
      { role: 'user' as const, content: message }
    ]

    const result = await generateText({
      model: anthropic(env.ANTHROPIC_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 650,
      tools: {
        get_portfolio_balances: tool({
          description: 'Fetch all token balances and DeFi positions for the user wallet',
          inputSchema: z.object({ walletAddress: z.string() }),
          execute: async ({ walletAddress }) => {
            try {
              return await tools.getPortfolioBalances(walletAddress)
            } catch (error) {
              logger.error({ error, walletAddress }, 'Agent portfolio tool execution failed')
              throw error
            }
          }
        }),
        swap_tokens: tool({
          description:
            'Get a Jupiter swap quote and prepare a token swap. Returns confirmation details. Never executes without a confirm button.',
          inputSchema: z.object({
            fromToken: z.string().describe('Token mint address or symbol to sell'),
            toToken: z.string().describe('Token mint address or symbol to buy'),
            amount: z.number().positive().describe('Amount in human-readable units'),
            walletAddress: z.string()
          }),
          execute: async (params) => {
            try {
              return await tools.prepareSwap(params)
            } catch (error) {
              logger.error({ error, params }, 'Agent swap tool execution failed')
              throw error
            }
          }
        }),
        get_yield_opportunities: tool({
          description: 'Find the best yield opportunities across Kamino, Raydium, and Marinade for a token',
          inputSchema: z.object({
            token: z.string(),
            amount: z.number().positive().optional(),
            riskAppetite: z.enum(['conservative', 'balanced', 'aggressive'])
          }),
          execute: async (params) => {
            try {
              return await tools.getYieldOpportunities(params)
            } catch (error) {
              logger.error({ error, params }, 'Agent yield tool execution failed')
              throw error
            }
          }
        }),
        get_token_price: tool({
          description: 'Get current price of a token in USD',
          inputSchema: z.object({ token: z.string() }),
          execute: async ({ token }) => {
            try {
              return await tools.getTokenPrice(token)
            } catch (error) {
              logger.error({ error, token }, 'Agent price tool execution failed')
              throw error
            }
          }
        }),
        set_price_alert: tool({
          description: 'Set a price alert for a token. Use the userId from the provided chat context.',
          inputSchema: z.object({
            token: z.string(),
            threshold: z.number().positive(),
            direction: z.enum(['above', 'below']),
            userId: z.number().optional()
          }),
          execute: async (params) => {
            try {
              return await tools.setPriceAlert({ ...params, userId: params.userId ?? user.id })
            } catch (error) {
              logger.error({ error, params }, 'Agent alert tool execution failed')
              throw error
            }
          }
        }),
        pay_for_data_x402: tool({
          description:
            'Pay for premium market data using x402 micropayment. Use when the user asks for detailed market analysis or sentiment.',
          inputSchema: z.object({
            dataType: z.string(),
            maxPaymentUsdc: z.number().positive().max(0.05)
          }),
          execute: async (params) => {
            try {
              return await tools.payForDataX402(params)
            } catch (error) {
              logger.error({ error, params }, 'Agent x402 tool execution failed')
              throw error
            }
          }
        })
      },
      stopWhen: stepCountIs(6)
    })

    return parseAgentResponse(result as AgentTextResult)
  } catch (error) {
    logger.error({ error, userId: user.id }, 'Agent run failed')
    return {
      text: 'I ran into an issue reasoning through that request. Please try again with a little more detail.'
    }
  }
}

function parseAgentResponse(result: AgentTextResult): AgentResponse {
  const outputs = collectToolOutputs(result)
  const pendingSwap = outputs.find((output) => asString(asRecord(output)?.kind) === 'pending_swap')
  const pendingRecord = asRecord(pendingSwap)

  if (pendingRecord) {
    const text = asString(pendingRecord.text) ?? result.text
    const swapId = asString(pendingRecord.swapId)
    const inlineKeyboard = parseInlineKeyboard(pendingRecord.inlineKeyboard)

    return {
      text,
      inlineKeyboard,
      pendingActionId: swapId
    }
  }

  const responseText = result.text.trim()
  if (responseText.length > 0) {
    return { text: responseText }
  }

  const messageResult = outputs
    .map((output) => asRecord(output))
    .map((record) => asString(record?.message))
    .find((message) => message && message.length > 0)

  return {
    text: messageResult ?? 'Done.'
  }
}

function collectToolOutputs(result: AgentTextResult): unknown[] {
  const topLevel = result.toolResults ?? []
  const stepped = result.steps?.flatMap((step) => step.toolResults ?? []) ?? []
  const rawResults = [...topLevel, ...stepped]

  return rawResults.map((item) => {
    const record = asRecord(item)
    return record?.output ?? record?.result ?? item
  })
}

function parseInlineKeyboard(value: unknown): InlineKeyboard | undefined {
  const record = asRecord(value)
  const rows = record?.inline_keyboard
  if (!Array.isArray(rows)) {
    return undefined
  }

  return {
    inline_keyboard: rows
      .filter(Array.isArray)
      .map((row) =>
        row
          .map((button) => asRecord(button))
          .filter((button): button is Record<string, unknown> => Boolean(button))
          .map((button) => ({
            text: asString(button.text) ?? 'Open',
            callback_data: asString(button.callback_data),
            url: asString(button.url)
          }))
      )
  }
}

function normalizeRisk(value: string): RiskAppetite {
  if (value === 'conservative' || value === 'aggressive') {
    return value
  }

  return 'balanced'
}
