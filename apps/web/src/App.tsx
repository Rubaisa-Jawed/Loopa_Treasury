import { useEffect } from 'react'
import { BarChart3, Coins, Repeat2, Settings, ShieldCheck, Wallet } from 'lucide-react'
import Dashboard from './pages/Dashboard.js'
import Positions from './pages/Positions.js'
import Swap from './pages/Swap.js'
import SettingsPage from './pages/Settings.js'
import { usePilotStore } from './store/index.js'
import { useWallet } from './hooks/useWallet.js'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'positions', label: 'Positions', icon: Coins },
  { id: 'swap', label: 'Swap', icon: Repeat2 },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const

export default function App() {
  const activeTab = usePilotStore((state) => state.activeTab)
  const setActiveTab = usePilotStore((state) => state.setActiveTab)
  const walletAddress = useWallet()

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    webApp?.ready()
    webApp?.expand()
  }, [])

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[var(--app-bg)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#147d64] text-sm font-bold text-white">
              LT
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold">LoopTreasury</div>
              <div className="flex items-center gap-1 text-xs text-[var(--app-muted)]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Non-custodial Solana treasury agent</span>
              </div>
            </div>
          </div>
          <div className="hidden min-w-0 items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-2 text-xs text-[var(--app-muted)] sm:flex">
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="truncate">{walletAddress || 'Wallet not connected'}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'positions' && <Positions />}
        {activeTab === 'swap' && <Swap />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[var(--app-panel)] px-2 py-2">
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs transition ${
                  selected ? 'tg-button' : 'text-[var(--app-muted)]'
                }`}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
