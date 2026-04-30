export const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4e5qB1MxMZvDpz7n3QPjz',
  MSOL: 'mSoLzYCxHd97ePJxwvYq8f7iBhFjK6LxSo7DqaH4N2'
} as const

export const TOKEN_DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  MSOL: 9
} as const

export type SupportedTokenSymbol = keyof typeof TOKEN_MINTS

export function isSupportedTokenSymbol(value: string): value is SupportedTokenSymbol {
  return value.toUpperCase() in TOKEN_MINTS
}

export function tokenSymbolToMint(symbolOrMint: string): string {
  const normalized = symbolOrMint.trim().toUpperCase()
  if (isSupportedTokenSymbol(normalized)) {
    return TOKEN_MINTS[normalized]
  }

  return symbolOrMint.trim()
}
