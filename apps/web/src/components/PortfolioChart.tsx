import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Portfolio } from '@pilot/shared'

const colors = ['#147d64', '#1d73a6', '#c98a18', '#be4860', '#536171']

interface PortfolioChartProps {
  portfolio: Portfolio
}

export default function PortfolioChart({ portfolio }: PortfolioChartProps) {
  const data = [
    ...portfolio.tokens.map((token) => ({
      name: token.symbol,
      value: token.usdValue
    })),
    ...portfolio.defiPositions.map((position) => ({
      name: position.protocol,
      value: position.currentValue
    }))
  ].filter((item) => item.value > 0)

  return (
    <div className="panel h-72 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Allocation</h2>
        <span className="text-xs text-[var(--app-muted)]">{data.length} assets</span>
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
            {data.map((item, index) => (
              <Cell key={item.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(Number(value))
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
