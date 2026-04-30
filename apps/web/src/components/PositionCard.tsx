import { Landmark, Waves, Sprout } from 'lucide-react'
import type { DeFiPosition } from '@pilot/shared'

interface PositionCardProps {
  position: DeFiPosition
}

export default function PositionCard({ position }: PositionCardProps) {
  const Icon = position.protocol === 'kamino' ? Landmark : position.protocol === 'raydium' ? Waves : Sprout

  return (
    <article className="panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/12 text-emerald-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold capitalize">{position.poolName}</h3>
            <div className="text-xs uppercase tracking-normal text-[var(--app-muted)]">
              {position.protocol} {position.type}
            </div>
          </div>
        </div>
        <div className="rounded-md bg-emerald-600/12 px-2 py-1 text-sm font-medium text-emerald-700">
          {position.apy.toFixed(2)}%
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Metric label="Deposited" value={formatUsd(position.depositedValue)} />
        <Metric label="Current" value={formatUsd(position.currentValue)} />
        <Metric label="Earned" value={formatUsd(position.earnedYield)} />
      </div>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--app-muted)]">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}
