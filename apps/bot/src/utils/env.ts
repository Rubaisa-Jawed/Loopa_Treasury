import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

loadDotenv()

const optionalUrl = z.string().url().optional().or(z.literal(''))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_WEBHOOK_URL: optionalUrl,
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
  TELEGRAM_MINI_APP_URL: optionalUrl.default('http://localhost:5173'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-4-6'),
  HELIUS_API_KEY: z.string().min(1, 'HELIUS_API_KEY is required'),
  SOLANA_RPC_URL: z.string().url().optional().or(z.literal('')),
  SOLANA_NETWORK: z.enum(['mainnet-beta', 'devnet', 'testnet']).default('mainnet-beta'),
  PRIVY_APP_ID: z.string().optional().or(z.literal('')),
  PRIVY_APP_SECRET: z.string().optional().or(z.literal('')),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  X402_FACILITATOR_URL: optionalUrl.default('https://x402.org/facilitator'),
  X402_DATA_ENDPOINT: optionalUrl,
  AGENT_WALLET_PRIVATE_KEY: z.string().optional().or(z.literal('')),
  PHANTOM_MCP_COMMAND: z.string().optional().or(z.literal('')),
  PHANTOM_MCP_ARGS: z.string().optional().or(z.literal('')),
  PHANTOM_MCP_NETWORK_ID: z.string().min(1).default('solana:mainnet'),
  JUPITER_API_URL: z.string().url().default('https://lite-api.jup.ag/swap/v1'),
  HELIUS_RPC_URL: z.string().url().optional().or(z.literal(''))
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${details}`)
  }

  return parsed.data
}

export const env = loadEnv()

function loadDotenv(): void {
  const seen = new Set<string>()
  for (const start of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    let current = start
    const root = parse(current).root

    while (!seen.has(current)) {
      seen.add(current)
      const candidate = join(current, '.env')
      if (existsSync(candidate)) {
        config({ path: candidate, override: false })
        return
      }

      if (current === root) {
        break
      }

      current = dirname(current)
    }
  }
}
