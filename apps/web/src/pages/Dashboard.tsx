import { ArrowUpRight, BellRing, Search, ShieldCheck, Sprout, Repeat2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PortfolioChart from '../components/PortfolioChart.js'
import TokenBalance from '../components/TokenBalance.js'
import PositionCard from '../components/PositionCard.js'
import { usePortfolio } from '../hooks/usePortfolio.js'
import { usePilotStore } from '../store/index.js'

const pnl = [
  { day: 'Thu', value: 6088 },
  { day: 'Fri', value: 6120 },
  { day: 'Sat', value: 6235 },
  { day: 'Sun', value: 6198 },
  { day: 'Mon', value: 6310 },
  { day: 'Tue', value: 6392 },
  { day: 'Wed', value: 6428 }
]

export default function Dashboard() {
  const portfolio = usePortfolio()
  const setActiveTab = usePilotStore((state) => state.setActiveTab)

  return (
    <div className="space-y-4">
      <section className="panel metric-band overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-[var(--app-muted)]">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <span>Total treasury value</span>
            </div>
            <h1 className="mono-tabular mt-2 text-4xl font-semibold tracking-normal">{formatUsd(portfolio.totalUsdValue)}</h1>
            <div className="mt-3 flex items-center gap-1 text-sm font-medium text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
              <span>+5.6% this week</span>
            </div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-right text-sm text-slate-700">
            <div className="mono-tabular font-semibold">{portfolio.defiPositions.length}</div>
            <div className="text-[var(--app-muted)]">positions</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <MiniMetric label="Liquid" value={formatUsd(portfolio.tokens.reduce((sum, token) => sum + token.usdValue, 0))} />
        <MiniMetric label="DeFi" value={formatUsd(portfolio.defiPositions.reduce((sum, item) => sum + item.currentValue, 0))} />
        <MiniMetric label="Alerts" value="Ready" />
      </section>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <PortfolioChart portfolio={portfolio} />
        <section className="panel h-72 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">PnL</h2>
            <span className="text-xs text-[var(--app-muted)]">7D</span>
          </div>
          <ResponsiveContainer width="100%" height="86%">
            <LineChart data={pnl} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(value) => formatUsd(Number(value))} />
              <Line type="monotone" dataKey="value" stroke="#1f8f72" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="grid grid-cols-3 gap-2">
        <ActionButton label="Swap" icon={<Repeat2 className="h-5 w-5" />} onClick={() => setActiveTab('swap')} />
        <ActionButton label="Find Yield" icon={<Search className="h-5 w-5" />} onClick={() => sendText('Find yield')} />
        <ActionButton label="Stake SOL" icon={<Sprout className="h-5 w-5" />} onClick={() => sendText('Stake SOL')} />
      </section>

      <section className="panel flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
          <BellRing className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Monitoring is armed</h2>
          <p className="text-sm text-[var(--app-muted)]">LoopTreasury watches large moves, alerts, and position changes.</p>
        </div>
      </section>

      <section className="panel divide-y divide-black/10 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold">Tokens</h2>
          <span className="text-xs text-[var(--app-muted)]">{portfolio.tokens.length}</span>
        </div>
        {portfolio.tokens.map((token) => (
          <TokenBalance key={token.mint} token={token} />
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Active positions</h2>
          <button type="button" className="text-sm font-medium text-emerald-700" onClick={() => setActiveTab('positions')}>
            View all
          </button>
        </div>
        {portfolio.defiPositions.slice(0, 2).map((position) => (
          <PositionCard key={`${position.protocol}-${position.poolName}`} position={position} />
        ))}
      </section>
    </div>
  )
}

function ActionButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="panel flex h-20 flex-col items-center justify-center gap-2 font-medium transition hover:border-emerald-700/30 hover:bg-emerald-600/5"
      onClick={onClick}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <div className="text-xs text-[var(--app-muted)]">{label}</div>
      <div className="mono-tabular truncate text-sm font-semibold">{value}</div>
    </div>
  )
}

function sendText(text: string) {
  window.Telegram?.WebApp.sendData(JSON.stringify({ type: 'chat_request', text }))
  window.Telegram?.WebApp.close()
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}
