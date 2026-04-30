export type RiskAppetite = 'conservative' | 'balanced' | 'aggressive'

export interface TokenBalance {
  mint: string
  symbol: string
  name: string
  balance: number
  usdValue: number
  logoUri?: string
}

export interface DeFiPosition {
  protocol: 'kamino' | 'raydium' | 'marinade'
  type: 'lending' | 'lp' | 'staking'
  poolName: string
  depositedValue: number
  currentValue: number
  earnedYield: number
  apy: number
}

export interface Portfolio {
  walletAddress: string
  solBalance: number
  solUsdValue: number
  tokens: TokenBalance[]
  defiPositions: DeFiPosition[]
  totalUsdValue: number
  fetchedAt: Date
}

export interface YieldOpportunity {
  protocol: string
  type: 'lending' | 'lp' | 'staking'
  apy: number
  tvl: number
  risk: 'low' | 'medium' | 'high'
  description: string
  actionLabel: string
}

export interface PendingSwap {
  id: string
  fromToken: string
  toToken: string
  inputAmount: number
  expectedOutput: number
  priceImpact: number
  fee: number
  route: string[]
  expiresAt: Date
}

export interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
  web_app?: {
    url: string
  }
}

export interface InlineKeyboard {
  inline_keyboard: InlineKeyboardButton[][]
}

export interface AgentResponse {
  text: string
  inlineKeyboard?: InlineKeyboard
  openMiniApp?: boolean
  pendingActionId?: string
}
