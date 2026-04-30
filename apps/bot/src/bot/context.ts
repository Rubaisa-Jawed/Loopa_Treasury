import type { Context, SessionFlavor } from 'grammy'
import type { RiskAppetite } from '@pilot/shared'

export interface SessionData {
  walletAddress: string | null
  riskAppetite: RiskAppetite
  awaitingWalletAddress: boolean
}

export type PilotContext = Context & SessionFlavor<SessionData>

export function initialSession(): SessionData {
  return {
    walletAddress: null,
    riskAppetite: 'balanced',
    awaitingWalletAddress: false
  }
}
