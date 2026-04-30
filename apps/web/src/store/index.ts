import { create } from 'zustand'
import type { Portfolio, RiskAppetite } from '@pilot/shared'

interface PilotState {
  activeTab: 'dashboard' | 'positions' | 'swap' | 'settings'
  walletAddress: string
  riskAppetite: RiskAppetite
  portfolio: Portfolio
  setActiveTab: (tab: PilotState['activeTab']) => void
  setWalletAddress: (walletAddress: string) => void
  setRiskAppetite: (riskAppetite: RiskAppetite) => void
}

const now = new Date()

export const usePilotStore = create<PilotState>((set) => ({
  activeTab: 'dashboard',
  walletAddress: '',
  riskAppetite: 'balanced',
  portfolio: {
    walletAddress: '',
    solBalance: 12.4281,
    solUsdValue: 1841.35,
    totalUsdValue: 6428.92,
    fetchedAt: now,
    tokens: [
      {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        balance: 12.4281,
        usdValue: 1841.35
      },
      {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        balance: 2380.52,
        usdValue: 2380.52
      },
      {
        mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
        symbol: 'mSOL',
        name: 'Marinade staked SOL',
        balance: 8.14,
        usdValue: 1318.4
      }
    ],
    defiPositions: [
      {
        protocol: 'kamino',
        type: 'lending',
        poolName: 'USDC Main Market',
        depositedValue: 900,
        currentValue: 929.18,
        earnedYield: 29.18,
        apy: 7.84
      },
      {
        protocol: 'marinade',
        type: 'staking',
        poolName: 'mSOL liquid staking',
        depositedValue: 1280,
        currentValue: 1318.4,
        earnedYield: 38.4,
        apy: 7.12
      }
    ]
  },
  setActiveTab: (activeTab) => set({ activeTab }),
  setWalletAddress: (walletAddress) =>
    set((state) => ({
      walletAddress,
      portfolio: {
        ...state.portfolio,
        walletAddress
      }
    })),
  setRiskAppetite: (riskAppetite) => set({ riskAppetite })
}))
