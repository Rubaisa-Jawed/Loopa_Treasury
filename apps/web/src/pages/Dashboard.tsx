import { ArrowUpRight, Search, Sprout, Repeat2 } from 'lucide-react'
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
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-[var(--app-muted)]">Total value</div>
            <h1 className="mt-1 text-4xl font-semibold">{formatUsd(portfolio.totalUsdValue)}</h1>
            <div className="mt-2 flex items-center gap-1 text-sm text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
              <span>+5.6% this week</span>
            </div>
          </div>
          <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-right text-sm text-amber-700">
            <div className="font-semibold">{portfolio.defiPositions.length}</div>
            <div>positions</div>
          </div>
        </div>
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
    <button type="button" className="panel flex h-20 flex-col items-center justify-center gap-2 font-medium" onClick={onClick}>
      {icon}
      <span className="text-sm">{label}</span>
    </button>
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
