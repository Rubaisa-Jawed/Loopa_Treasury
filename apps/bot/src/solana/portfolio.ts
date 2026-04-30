import { PublicKey } from '@solana/web3.js'
import type { DeFiPosition, Portfolio, TokenBalance } from '@pilot/shared'
import { TOKEN_MINTS } from '@pilot/shared'
import { env } from '../utils/env.js'
import { fetchJson, asNumber, asRecord, asString } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import { getConnection, validateSolanaAddress } from './wallet.js'
import { getTokenPrice } from './jupiter.js'
import { getKaminoPositions } from './kamino.js'
import { getRaydiumPositions } from './raydium.js'
import { getMarinadePositions } from './marinade.js'

interface HeliusBalanceResponse {
  nativeBalance?: number
  tokens?: unknown[]
}

export async function fetchPortfolio(walletAddress: string): Promise<Portfolio> {
  try {
    if (!validateSolanaAddress(walletAddress)) {
      throw new Error('Invalid Solana wallet address')
    }

    const [baseBalances, defiPositions] = await Promise.all([
      fetchWalletBalances(walletAddress),
      fetchDefiPositions(walletAddress)
    ])

    const totalUsdValue =
      baseBalances.solUsdValue +
      baseBalances.tokens.reduce((sum, token) => sum + token.usdValue, 0) +
      defiPositions.reduce((sum, position) => sum + position.currentValue, 0)

    return {
      walletAddress,
      solBalance: baseBalances.solBalance,
      solUsdValue: baseBalances.solUsdValue,
      tokens: baseBalances.tokens,
      defiPositions,
      totalUsdValue,
      fetchedAt: new Date()
    }
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to fetch portfolio')
    throw error
  }
}

async function fetchWalletBalances(walletAddress: string): Promise<{
  solBalance: number
  solUsdValue: number
  tokens: TokenBalance[]
}> {
  try {
    const heliusUrl = `https://mainnet.helius-rpc.com/v0/addresses/${walletAddress}/balances?api-key=${encodeURIComponent(
      env.HELIUS_API_KEY
    )}`

    const helius = await fetchJson<HeliusBalanceResponse>(heliusUrl).catch((error: unknown) => {
      logger.warn({ error, walletAddress }, 'Helius balances endpoint failed; falling back to RPC token accounts')
      return undefined
    })

    if (helius) {
      return parseHeliusBalances(helius)
    }

    return fetchBalancesFromRpc(walletAddress)
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to fetch wallet balances')
    throw error
  }
}

async function parseHeliusBalances(response: HeliusBalanceResponse): Promise<{
  solBalance: number
  solUsdValue: number
  tokens: TokenBalance[]
}> {
  try {
    const solBalance = (response.nativeBalance ?? 0) / 1_000_000_000
    const solPrice = await getTokenPrice(TOKEN_MINTS.SOL)
    const tokens: TokenBalance[] = []

    for (const token of response.tokens ?? []) {
      const record = asRecord(token)
      if (!record) continue

      const mint = asString(record.mint) ?? asString(record.tokenMint)
      const amount = asNumber(record.amount ?? record.balance) ?? 0
      const decimals = asNumber(record.decimals) ?? 0
      const symbol = asString(record.symbol) ?? asString(record.tokenSymbol) ?? shortMint(mint)
      const name = asString(record.name) ?? symbol

      if (!mint || amount <= 0) continue

      const balance = decimals > 0 ? amount / 10 ** decimals : amount
      const price = await getTokenPrice(mint)
      tokens.push({
        mint,
        symbol,
        name,
        balance,
        usdValue: balance * price,
        logoUri: asString(record.logoURI ?? record.logoUri)
      })
    }

    return {
      solBalance,
      solUsdValue: solBalance * solPrice,
      tokens
    }
  } catch (error) {
    logger.error({ error }, 'Failed to parse Helius balances')
    throw error
  }
}

async function fetchBalancesFromRpc(walletAddress: string): Promise<{
  solBalance: number
  solUsdValue: number
  tokens: TokenBalance[]
}> {
  try {
    const connection = getConnection()
    const owner = new PublicKey(walletAddress)
    const lamports = await connection.getBalance(owner, 'confirmed')
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    })
    const solBalance = lamports / 1_000_000_000
    const solPrice = await getTokenPrice(TOKEN_MINTS.SOL)
    const tokens: TokenBalance[] = []

    for (const account of tokenAccounts.value) {
      const parsed = account.account.data.parsed as {
        info?: {
          mint?: string
          tokenAmount?: {
            uiAmount?: number
            decimals?: number
          }
        }
      }

      const mint = parsed.info?.mint
      const balance = parsed.info?.tokenAmount?.uiAmount ?? 0
      if (!mint || balance <= 0) continue

      const price = await getTokenPrice(mint)
      tokens.push({
        mint,
        symbol: shortMint(mint),
        name: shortMint(mint),
        balance,
        usdValue: balance * price
      })
    }

    return {
      solBalance,
      solUsdValue: solBalance * solPrice,
      tokens
    }
  } catch (error) {
    logger.error({ error, walletAddress }, 'RPC portfolio fallback failed')
    throw error
  }
}

async function fetchDefiPositions(walletAddress: string): Promise<DeFiPosition[]> {
  try {
    const [kamino, raydium, marinade] = await Promise.all([
      getKaminoPositions(walletAddress),
      getRaydiumPositions(walletAddress),
      getMarinadePositions(walletAddress)
    ])

    return [...kamino, ...raydium, ...marinade]
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to fetch DeFi positions')
    return []
  }
}

function shortMint(mint?: string): string {
  if (!mint) return 'TOKEN'
  if (mint === TOKEN_MINTS.SOL) return 'SOL'
  if (mint === TOKEN_MINTS.USDC) return 'USDC'
  if (mint === TOKEN_MINTS.USDT) return 'USDT'
  if (mint === TOKEN_MINTS.MSOL) return 'mSOL'
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`
}
