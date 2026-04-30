import { useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { ChevronDown, Repeat2 } from 'lucide-react'
import ConfirmDrawer from '../components/ConfirmDrawer.js'

const tokens = ['SOL', 'USDC', 'USDT', 'mSOL']

export default function Swap() {
  const [fromToken, setFromToken] = useState('SOL')
  const [toToken, setToToken] = useState('USDC')
  const [amount, setAmount] = useState('1')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const numericAmount = Number(amount)
  const validAmount = Number.isFinite(numericAmount) && numericAmount > 0
  const estimated = validAmount ? estimateOutput(numericAmount, fromToken, toToken) : 0
  const priceImpact = validAmount ? Math.min(0.15 + numericAmount / 1000, 2.4) : 0

  const confirm = () => {
    window.Telegram?.WebApp.sendData(
      JSON.stringify({
        type: 'swap_request',
        fromToken,
        toToken,
        amount: numericAmount
      })
    )
    window.Telegram?.WebApp.close()
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Swap</h1>
        <p className="text-sm text-[var(--app-muted)]">Jupiter route preview in chat</p>
      </header>

      <section className="panel space-y-4 p-4">
        <TokenAmount label="From" token={fromToken} onTokenChange={setFromToken} amount={amount} onAmountChange={setAmount} />

        <button
          type="button"
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-black/10"
          onClick={() => {
            setFromToken(toToken)
            setToToken(fromToken)
          }}
          aria-label="Reverse tokens"
          title="Reverse tokens"
        >
          <Repeat2 className="h-5 w-5" />
        </button>

        <TokenAmount label="To" token={toToken} onTokenChange={setToToken} amount={estimated.toFixed(4)} readOnly />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-cyan-600/10 p-3 text-cyan-800">
            <div className="text-xs">Rate</div>
            <div className="font-semibold">1 {fromToken} ~= {(estimated / Math.max(numericAmount, 1)).toFixed(4)} {toToken}</div>
          </div>
          <div className={`rounded-lg p-3 ${priceImpact > 1 ? 'bg-rose-600/10 text-rose-700' : 'bg-emerald-600/10 text-emerald-700'}`}>
            <div className="text-xs">Impact</div>
            <div className="font-semibold">{priceImpact.toFixed(2)}%</div>
          </div>
        </div>

        <button
          type="button"
          className="tg-button h-12 w-full rounded-lg font-semibold disabled:opacity-50"
          disabled={!validAmount || fromToken === toToken}
          onClick={() => setDrawerOpen(true)}
        >
          Swap
        </button>
      </section>

      <ConfirmDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        summary={{
          from: fromToken,
          to: toToken,
          amount,
          expectedOutput: estimated.toFixed(4),
          priceImpact,
          fee: '~$0.02'
        }}
        onConfirm={confirm}
      />
    </div>
  )
}

function TokenAmount({
  label,
  token,
  onTokenChange,
  amount,
  onAmountChange,
  readOnly = false
}: {
  label: string
  token: string
  onTokenChange: (token: string) => void
  amount: string
  onAmountChange?: (amount: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="rounded-lg border border-black/10 p-3">
      <div className="mb-2 text-xs text-[var(--app-muted)]">{label}</div>
      <div className="flex items-center gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none"
          value={amount}
          readOnly={readOnly}
          inputMode="decimal"
          onChange={(event) => onAmountChange?.(event.target.value)}
        />
        <TokenSelect value={token} onValueChange={onTokenChange} />
      </div>
    </div>
  )
}

function TokenSelect({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger className="flex h-10 items-center gap-2 rounded-lg border border-black/10 px-3 font-medium">
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 rounded-lg border border-black/10 bg-[var(--app-panel)] p-1 shadow-xl">
          <Select.Viewport>
            {tokens.map((token) => (
              <Select.Item key={token} value={token} className="cursor-pointer rounded-md px-3 py-2 outline-none data-[highlighted]:bg-emerald-600/10">
                <Select.ItemText>{token}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function estimateOutput(amount: number, fromToken: string, toToken: string): number {
  const prices: Record<string, number> = {
    SOL: 148.16,
    USDC: 1,
    USDT: 1,
    mSOL: 161.97
  }

  return (amount * prices[fromToken]) / prices[toToken] * 0.998
}
