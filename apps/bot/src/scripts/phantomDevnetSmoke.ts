import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js'
import {
  closePhantomMcp,
  getPhantomWalletInfo,
  sendSolanaTransactionWithPhantom,
  simulateSolanaTransactionWithPhantom
} from '../agent/mcp/phantom.js'

const MIN_BALANCE_LAMPORTS = 0.05 * LAMPORTS_PER_SOL
const AIRDROP_LAMPORTS = 1 * LAMPORTS_PER_SOL

async function main(): Promise<void> {
  const shouldSend = process.argv.includes('--send')
  const networkId = networkIdFromArgs()

  if (networkId !== 'solana:devnet' && networkId !== 'solana:testnet') {
    throw new Error(
      [
        'This smoke test only runs on Solana devnet/testnet so it cannot spend real funds.',
        'Run the default devnet smoke test, or pass --network=solana:devnet / --network=solana:testnet.'
      ].join('\n')
    )
  }

  const connection = new Connection(rpcUrlForNetwork(networkId), 'confirmed')
  const wallet = await getPhantomWalletInfo()
  const walletPublicKey = new PublicKey(wallet.solanaAddress)

  console.log(`Phantom MCP wallet: ${wallet.solanaAddress}`)
  console.log(`Network: ${networkId}`)
  console.log(`RPC: ${connection.rpcEndpoint}`)

  await fundWalletIfNeeded(connection, walletPublicKey)

  const transaction = await buildTinyTransfer(connection, walletPublicKey)
  const simulation = await simulateSolanaTransactionWithPhantom(transaction, networkId)
  console.log(`Simulation: ${simulation.summary}`)

  if (!shouldSend) {
    console.log('Simulation complete. Add --send to broadcast this tiny devnet transaction.')
    return
  }

  const result = await sendSolanaTransactionWithPhantom(transaction, networkId)
  console.log(`Sent devnet transaction: ${result.signature}`)
}

async function fundWalletIfNeeded(connection: Connection, walletPublicKey: PublicKey): Promise<void> {
  const balance = await connection.getBalance(walletPublicKey, 'confirmed')
  console.log(`Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`)

  if (balance >= MIN_BALANCE_LAMPORTS) {
    return
  }

  console.log(`Requesting devnet airdrop: ${AIRDROP_LAMPORTS / LAMPORTS_PER_SOL} SOL`)
  const latest = await connection.getLatestBlockhash('confirmed')
  const signature = await connection.requestAirdrop(walletPublicKey, AIRDROP_LAMPORTS)
  await connection.confirmTransaction({ signature, ...latest }, 'confirmed')

  const updatedBalance = await connection.getBalance(walletPublicKey, 'confirmed')
  console.log(`Updated balance: ${(updatedBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`)
}

async function buildTinyTransfer(connection: Connection, walletPublicKey: PublicKey): Promise<string> {
  const recipient = Keypair.generate().publicKey
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  const message = new TransactionMessage({
    payerKey: walletPublicKey,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: recipient,
        lamports: 1
      })
    ]
  }).compileToV0Message()

  const transaction = new VersionedTransaction(message)
  return Buffer.from(transaction.serialize()).toString('base64')
}

function rpcUrlForNetwork(networkId: string): string {
  const override = process.env.PHANTOM_MCP_SMOKE_RPC_URL
  if (override) {
    return override
  }

  if (networkId === 'solana:testnet') {
    return 'https://api.testnet.solana.com'
  }

  return 'https://api.devnet.solana.com'
}

function networkIdFromArgs(): string {
  const networkArg = process.argv.find((arg) => arg.startsWith('--network='))
  return networkArg?.replace('--network=', '') || 'solana:devnet'
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePhantomMcp()
  })
