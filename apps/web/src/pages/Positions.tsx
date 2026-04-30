import PositionCard from '../components/PositionCard.js'
import { usePortfolio } from '../hooks/usePortfolio.js'

export default function Positions() {
  const portfolio = usePortfolio()

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Positions</h1>
        <p className="text-sm text-[var(--app-muted)]">{formatUsd(totalPositions(portfolio))} deployed</p>
      </header>

      <section className="space-y-3">
        {portfolio.defiPositions.map((position) => (
          <PositionCard key={`${position.protocol}-${position.poolName}`} position={position} />
        ))}
      </section>
    </div>
  )
}

function totalPositions(portfolio: ReturnType<typeof usePortfolio>): number {
  return portfolio.defiPositions.reduce((sum, position) => sum + position.currentValue, 0)
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}
