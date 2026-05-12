import { env } from '../utils/env.js'

export const PHANTOM_LIVE_DEMO_SOL = 0.01
export const PHANTOM_MIN_SWAP_SOL_BUFFER = 0.003

export function formatSolBalance(balance: number | undefined): string {
  if (balance === undefined) return 'checking'
  if (balance === 0) return '0'
  if (balance < 0.000001) return '<0.000001'
  return balance.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}

export function phantomFundingPageUrl(walletAddress: string): string {
  const url = new URL(env.TELEGRAM_MINI_APP_URL || 'https://phantom.app/')
  url.searchParams.set('fundWallet', walletAddress)
  url.searchParams.set('amount', PHANTOM_LIVE_DEMO_SOL.toString())
  url.searchParams.set('open', 'phantom')
  return url.toString()
}

export function phantomUniversalBrowseUrl(targetUrl: string): string {
  const ref = env.TELEGRAM_MINI_APP_URL.startsWith('https://') ? env.TELEGRAM_MINI_APP_URL : 'https://phantom.app/'
  return `https://phantom.app/ul/browse/${encodeURIComponent(targetUrl)}?ref=${encodeURIComponent(ref)}`
}

export function solscanAccountUrl(walletAddress: string): string {
  const cluster = env.SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${env.SOLANA_NETWORK}`
  return `https://solscan.io/account/${walletAddress}${cluster}`
}
