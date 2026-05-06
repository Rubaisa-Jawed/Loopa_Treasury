import type { DeFiPosition, Portfolio, TokenBalance, YieldOpportunity } from '@pilot/shared'

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

const compactUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2
})

export function formatUsd(value: number): string {
  return usdFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatCompactUsd(value: number): string {
  return compactUsdFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatTokenAmount(value: number, symbol: string): string {
  const decimals = symbol.toUpperCase() === 'SOL' || symbol.toUpperCase() === 'MSOL' ? 4 : 2

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(Number.isFinite(value) ? value : 0)} ${symbol.toUpperCase()}`
}

export function formatPortfolioMessage(portfolio: Portfolio): string {
  const topTokens = portfolio.tokens
    .filter((token) => token.usdValue > 0)
    .sort((a, b) => b.usdValue - a.usdValue)
    .slice(0, 5)
    .map(formatTokenLine)

  const positions = portfolio.defiPositions.slice(0, 5).map(formatPositionLine)

  return [
    '*LoopTreasury Portfolio*',
    '',
    `Total value: *${formatUsd(portfolio.totalUsdValue)}*`,
    `SOL: ${formatTokenAmount(portfolio.solBalance, 'SOL')} (${formatUsd(portfolio.solUsdValue)})`,
    '',
    '*Top holdings*',
    topTokens.length > 0 ? topTokens.join('\n') : 'No SPL token balances found yet.',
    '',
    '*Active DeFi positions*',
    positions.length > 0 ? positions.join('\n') : 'No active Kamino, Raydium, or Marinade positions detected.',
    '',
    `_Updated ${portfolio.fetchedAt.toISOString()}_`
  ].join('\n')
}

export function formatYieldOpportunities(opportunities: YieldOpportunity[]): string {
  if (opportunities.length === 0) {
    return 'I could not find reliable yield options for that token right now.'
  }

  const rows = opportunities.map((opportunity, index) => [
    `${index + 1}`,
    opportunity.protocol.slice(0, 12),
    `${opportunity.apy.toFixed(2)}%`,
    formatCompactUsd(opportunity.tvl),
    opportunity.risk
  ])

  const table = formatFixedTable(['#', 'Protocol', 'APY', 'TVL', 'Risk'], rows)
  const pick = opportunities[0]

  return [
    '*Yield Opportunities*',
    '',
    '```',
    table,
    '```',
    '',
    `*Pick:* ${pick.protocol} ${pick.type} at ${pick.apy.toFixed(2)}% APY.`,
    pick.description
  ].join('\n')
}

export function formatFixedTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length))
  )
  const render = (values: string[]) => values.map((value, index) => value.padEnd(widths[index])).join('  ')
  const separator = widths.map((width) => '-'.repeat(width)).join('  ')

  return [render(headers), separator, ...rows.map(render)].join('\n')
}

function formatTokenLine(token: TokenBalance): string {
  return `- ${token.symbol}: ${formatTokenAmount(token.balance, token.symbol)} (${formatUsd(token.usdValue)})`
}

function formatPositionLine(position: DeFiPosition): string {
  return `- ${position.protocol}: ${position.poolName} | ${formatUsd(position.currentValue)} | ${position.apy.toFixed(2)}% APY`
}

export function truncateTelegramMessage(message: string): string[] {
  const limit = 3900
  if (message.length <= limit) {
    return [message]
  }

  const chunks: string[] = []
  let current = message
  while (current.length > limit) {
    const splitAt = current.lastIndexOf('\n', limit)
    const index = splitAt > 1000 ? splitAt : limit
    chunks.push(current.slice(0, index))
    current = current.slice(index).trimStart()
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}
