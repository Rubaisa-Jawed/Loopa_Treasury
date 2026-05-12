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
- Optional: Privy app credentials and a real x402 data endpoint

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
PHANTOM_MCP_COMMAND=npx
PHANTOM_MCP_ARGS=-y @phantom/mcp-server@latest
PHANTOM_MCP_NETWORK_ID=solana:mainnet
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
- `/phantom` starts/checks Phantom MCP and shows the executable test wallet
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
5. The first Confirm builds the Jupiter transaction and asks Phantom MCP to simulate it.
6. The bot sends a second Sign & Send button only if simulation is not blocked.
7. Only the second approval calls `executeSwap`.
8. Phantom MCP signs and sends the built Jupiter transaction.

If Phantom MCP is not configured, execution fails safely after confirmation and the quote flow remains demoable.

## Phantom MCP Flow

LoopTreasury launches Phantom MCP through stdio using:

```bash
npx -y @phantom/mcp-server@latest
```

Run `/phantom` in Telegram to check the connection. The first run may open Phantom device authentication on the developer machine. Phantom's current MCP flow uses browser-based sign-in with Google or Apple, then creates a dedicated embedded agent wallet. This wallet is separate from your existing mobile Phantom wallet. For executable hackathon tests:

1. Run `/start` so your Telegram profile exists.
2. Run `/phantom`.
3. Complete Phantom authentication if prompted.
4. Fund the displayed MCP agent wallet with a tiny SOL amount for fees.
5. Tap `Use MCP wallet for tests`.
6. Ask: `Swap 0.001 SOL to USDC`.
7. Tap `Confirm`, review the Phantom simulation, then tap `Sign & Send`.

Users may still paste any public Solana address for portfolio and quote analysis, but those wallets are read-only. LoopTreasury only signs from the Phantom MCP agent wallet and never asks for a private key or seed phrase.

On mobile, the `Open Phantom App` button uses Phantom's universal browse deeplink (`https://phantom.app/ul/browse/...`) so installed Phantom apps can intercept the link. If the Mini App is only running at `localhost`, the button opens Phantom itself; for a real mobile dashboard open, set `TELEGRAM_MINI_APP_URL` to a reachable HTTPS deployment.

## No-Real-Funds Testing

Solana local validators and Surfpool can clone accounts/programs from mainnet into a local RPC, but Phantom MCP signs and broadcasts through Phantom-supported network IDs such as `solana:mainnet`, `solana:devnet`, and `solana:testnet`. A localhost fork is useful for program/RPC tests, but it will not prove the Phantom MCP send path for the Telegram swap flow.

For an end-to-end Phantom MCP signing test without real funds, run:

```bash
pnpm --filter @pilot/bot phantom:smoke
```

The smoke test targets `solana:devnet` by default, gets the Phantom MCP agent wallet, airdrops devnet SOL when needed, builds a one-lamport transfer, and asks Phantom MCP to simulate it. To also broadcast the tiny devnet transfer:

```bash
pnpm --filter @pilot/bot phantom:smoke:send
```

The production Jupiter swap flow still uses mainnet liquidity and requires real mainnet assets. For demos without funds, use `/phantom` plus the devnet smoke script to prove MCP wallet auth/signing, and use Telegram swap quotes in quote-only/watch mode to demonstrate the product flow.

To run the live mainnet data path without broadcasting, use the mainnet dry run:

```bash
pnpm --filter @pilot/bot phantom:mainnet:dry-run
```

This uses the Phantom MCP wallet, fetches a real Jupiter mainnet quote, builds the real mainnet swap transaction, and calls Phantom MCP simulation on `solana:mainnet`. If the wallet has no funds, Phantom may block with an insufficient-balance simulation result; that still proves the live quote/build/simulation path without sending anything. You can change the dry-run pair or size:

```bash
pnpm --filter @pilot/bot phantom:mainnet:dry-run -- --amount=0.001 --from=SOL --to=USDC
```

## Sponsor Integrations

- Phantom: MCP stdio server for wallet discovery, transaction simulation, and final Solana send
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
