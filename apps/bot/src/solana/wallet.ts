import { Connection, PublicKey } from '@solana/web3.js'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'

let connection: Connection | undefined

export function validateSolanaAddress(address: string): boolean {
  try {
    const publicKey = new PublicKey(address)
    return PublicKey.isOnCurve(publicKey)
  } catch {
    return false
  }
}

export function getConnection(): Connection {
  if (!connection) {
    const endpoint =
      env.SOLANA_RPC_URL ||
      env.HELIUS_RPC_URL ||
      `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`
    connection = new Connection(endpoint, {
      commitment: 'confirmed'
    })
  }

  return connection
}

export async function waitForConfirmation(txSig: string): Promise<'confirmed' | 'failed'> {
  try {
    const result = await getConnection().confirmTransaction(txSig, 'confirmed')
    return result.value.err ? 'failed' : 'confirmed'
  } catch (error) {
    logger.error({ error, txSig }, 'Transaction confirmation failed')
    return 'failed'
  }
}
