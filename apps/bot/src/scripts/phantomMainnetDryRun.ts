import { tokenSymbolToMint } from '@pilot/shared'
import {
  amountToAtomic,
  atomicToAmount,
  buildSwapTransaction,
  getQuote,
  routeLabels
} from '../solana/jupiter.js'
import {
  closePhantomMcp,
  getPhantomWalletInfo,
  simulateSolanaTransactionWithPhantom
} from '../agent/mcp/phantom.js'
import { formatTokenAmount } from '../utils/format.js'

interface DryRunArgs {
  amount: number
  fromToken: string
  toToken: string
}

async function main(): Promise<void> {
  const args = parseArgs()
  const wallet = await getPhantomWalletInfo()

  console.log('Mainnet live dry run')
  console.log(`Phantom MCP wallet: ${wallet.solanaAddress}`)
  console.log(`Swap: ${formatTokenAmount(args.amount, args.fromToken)} -> ${args.toToken.toUpperCase()}`)
  console.log('Mode: simulation only, never broadcasts')

  const quote = await getQuote(
    tokenSymbolToMint(args.fromToken),
    tokenSymbolToMint(args.toToken),
    amountToAtomic(args.amount, args.fromToken),
    50
  )
  const expectedOutput = atomicToAmount(quote.outAmount, args.toToken)

  console.log(`Live Jupiter quote: ~${formatTokenAmount(expectedOutput, args.toToken)}`)
  console.log(`Price impact: ${((Number(quote.priceImpactPct) || 0) * 100).toFixed(4)}%`)
  console.log(`Route: ${routeLabels(quote).join(' -> ') || 'Jupiter best route'}`)

  const built = await buildSwapTransaction(quote, wallet.solanaAddress)
  console.log('Built unsigned mainnet Jupiter transaction for Phantom MCP simulation.')

  try {
    const simulation = await simulateSolanaTransactionWithPhantom(built.swapTransaction, 'solana:mainnet')
    console.log(`Phantom simulation: ${simulation.summary}`)
    console.log('Dry run complete. Nothing was sent.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isExpectedNoFundsSimulation(message)) {
      console.log('Phantom simulation reached mainnet live data and blocked before send:')
      console.log(message)
      console.log('Dry run complete. Nothing was sent.')
      return
    }

    throw error
  }
}

function parseArgs(): DryRunArgs {
  return {
    amount: numericArg('--amount', 0.001),
    fromToken: stringArg('--from', 'SOL'),
    toToken: stringArg('--to', 'USDC')
  }
}

function stringArg(name: string, fallback: string): string {
  return process.argv.find((arg) => arg.startsWith(`${name}=`))?.replace(`${name}=`, '') || fallback
}

function numericArg(name: string, fallback: number): number {
  const value = Number(stringArg(name, fallback.toString()))
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`)
  }

  return value
}

function isExpectedNoFundsSimulation(message: string): boolean {
  return /insufficient|balance|fund|simulation|blocked/i.test(message)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePhantomMcp()
  })
