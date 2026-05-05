# LoopTreasury

LoopTreasury is an AI-powered DeFi copilot for Solana that lives inside Telegram. Users can ask natural-language questions like "Find the best yield for my 500 USDC" or "Swap 1 SOL to USDC", and LoopTreasury reads their portfolio, compares DeFi opportunities, prepares transactions, and waits for explicit confirmation before anything goes on-chain.

Built for the Colosseum Frontier Hackathon 2026, LoopTreasury is shaped like a real startup product: a Telegram bot backend, ReAct-style AI agent, Solana protocol integrations, Redis-backed confirmation flows, background monitoring, and a Telegram Mini App portfolio dashboard.

## Architecture

```text
Telegram user
   |
   v
apps/bot: Grammy bot + AI agent
   |        |          |
   |        |          +-- BullMQ monitoring and alerts
   |        +------------- Vercel AI SDK + Claude tools
   |
   +-- PostgreSQL: users, alerts, transactions, conversations
   +-- Redis: sessions, rate limits, pending swaps, snapshots
   |
   v
Solana integrations
   +-- Helius RPC and balances
   +-- Jupiter swap quotes and transaction builds
   +-- Kamino, Raydium, Marinade yield reads
   +-- Phantom MCP signing
   +-- x402 premium data payment flow

apps/web: Telegram Mini App dashboard
packages/shared: shared TypeScript contracts
```

## Tech Stack

- Node.js 20+ and TypeScript strict mode
- pnpm workspaces and Turborepo
- Grammy for Telegram
- Vercel AI SDK with Anthropic Claude
- Drizzle ORM with PostgreSQL
- BullMQ and Redis
- Solana web3.js, Helius, Jupiter, Kamino, Raydium, Marinade
- React, Vite, Tailwind CSS, Recharts, Zustand, Radix UI

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop
- Telegram bot token from BotFather
- Anthropic API key
- Helius API key
- PostgreSQL and Redis URLs, or the local Docker services below
- Optional: Phantom MCP server URL, Privy app credentials, x402 endpoint

## Setup

1. Install dependencies:

```bash
pnpm install
```

On Windows PowerShell, if `pnpm` is blocked by execution policy, use:

```bash
pnpm.cmd install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Fill in `.env`:

```env
TELEGRAM_BOT_TOKEN=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
HELIUS_API_KEY=...
DATABASE_URL=postgres://pilot:pilot_dev@localhost:5433/pilot
REDIS_URL=redis://localhost:6379
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
TELEGRAM_MINI_APP_URL=http://localhost:5173
```

4. Start local services:

```bash
docker compose -f infra/docker-compose.yml up -d
```

5. Apply the initial schema:

```bash
pnpm --filter @pilot/bot db:migrate
```

The migration script loads the root `.env` file and applies the idempotent SQL files in `apps/bot/src/db/migrations`.

## Run Locally

Start the bot and Mini App together:

```bash
pnpm dev
```

Or run each app:

```bash
pnpm --filter @pilot/bot dev
pnpm --filter @pilot/web dev
```

Run validation tests:

```bash
pnpm --filter @pilot/bot test
pnpm build
```

The Mini App runs at `http://localhost:5173`. The bot uses long polling in development and Telegram webhooks in production when `NODE_ENV=production` and `TELEGRAM_WEBHOOK_URL` are set.

## Bot Usage

- `/start` creates a LoopTreasury profile and starts wallet onboarding
- `/portfolio` fetches wallet balances and active DeFi positions
- `/settings` updates risk appetite and notification preferences
- `/help` shows examples

Example chat prompts:

```text
What is my portfolio worth?
Find the best yield for 500 USDC
Swap 1 SOL to USDC
Alert me if SOL drops below 120
What is SOL sentiment right now?
```

## Transaction Safety

LoopTreasury never executes a transaction from the AI tool call. Swap flow is:

1. The agent calls `prepareSwap`.
2. Jupiter returns a quote.
3. LoopTreasury stores `swap:{uuid}` in Redis for 5 minutes.
4. The bot sends Confirm and Cancel buttons.
5. Only the Confirm callback calls `executeSwap`.
6. Phantom MCP signs and sends the built Jupiter transaction.

If Phantom MCP is not configured, execution fails safely after confirmation and the quote flow remains demoable.

## Sponsor Integrations

- Phantom: MCP signing path for `signAndSendTransaction`
- Coinbase x402: HTTP 402 payment handshake with mock fallback for demos
- Raydium: API v3 pool reads for LP yield discovery
- Privy: environment and Mini App structure ready for embedded wallet onboarding
- Kamino: public API reads for lending/yield data
- Marinade: liquid staking APY and mSOL position interface
- Helius: wallet balances and Solana RPC
- Jupiter: quote and swap transaction build flow

## Deployment

1. Deploy Postgres and Redis on Railway, Supabase/Upstash, or another managed provider.
2. Deploy `apps/web` to Vercel, Netlify, or Railway static hosting.
3. Set `TELEGRAM_MINI_APP_URL` to the deployed Mini App URL.
4. Deploy `apps/bot` to Railway or Fly.io.
5. Set `NODE_ENV=production` and `TELEGRAM_WEBHOOK_URL` to the public bot webhook URL.
6. Configure the Telegram bot's menu button to open the Mini App URL in BotFather.

## API Notes

Jupiter, Raydium, Kamino, and x402 APIs evolve quickly. LoopTreasury keeps base URLs configurable where possible:

- Jupiter docs: https://dev.jup.ag/docs
- Raydium APIs: https://docs.raydium.io/raydium/build/resources/apis
- Kamino API: https://api.kamino.finance/
- x402 docs: https://docs.x402.org/
- Helius docs: https://docs.helius.dev/

## Team

LoopTreasury is built for a small, fast-moving hackathon team focused on consumer Solana UX, agentic finance, and Telegram distribution.

## License

MIT
