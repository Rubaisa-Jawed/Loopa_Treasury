import type { TokenBalance as TokenBalanceType } from '@pilot/shared'

interface TokenBalanceProps {
  token: TokenBalanceType
}

export default function TokenBalance({ token }: TokenBalanceProps) {
  return (
    <article className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {token.logoUri ? (
          <img src={token.logoUri} alt="" className="h-9 w-9 rounded-full" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600/12 text-sm font-semibold text-cyan-700">
            {token.symbol.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-medium">{token.symbol}</div>
          <div className="truncate text-xs text-[var(--app-muted)]">{token.name}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium">{formatToken(token.balance, token.symbol)}</div>
        <div className="text-xs text-[var(--app-muted)]">{formatUsd(token.usdValue)}</div>
      </div>
    </article>
  )
}

function formatToken(value: number, symbol: string): string {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: symbol === 'SOL' || symbol === 'mSOL' ? 4 : 2
  }).format(value)} ${symbol}`
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}
