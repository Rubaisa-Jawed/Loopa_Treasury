import * as Select from '@radix-ui/react-select'
import { Bell, ChevronDown, Shield, Wallet } from 'lucide-react'
import type { RiskAppetite } from '@pilot/shared'
import { usePilotStore } from '../store/index.js'

const riskOptions: RiskAppetite[] = ['conservative', 'balanced', 'aggressive']

export default function SettingsPage() {
  const walletAddress = usePilotStore((state) => state.walletAddress)
  const riskAppetite = usePilotStore((state) => state.riskAppetite)
  const setRiskAppetite = usePilotStore((state) => state.setRiskAppetite)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--app-muted)]">Risk, monitoring, and wallet</p>
      </header>

      <section className="panel space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-emerald-700" />
          <div className="flex-1">
            <div className="font-medium">Risk appetite</div>
            <div className="text-xs text-[var(--app-muted)]">Current: {riskAppetite}</div>
          </div>
          <RiskSelect value={riskAppetite} onValueChange={setRiskAppetite} />
        </div>
      </section>

      <section className="panel divide-y divide-black/10 p-4">
        <Toggle label="Daily summary" checked />
        <Toggle label="Large moves" checked />
        <Toggle label="Position changes" checked />
      </section>

      <section className="panel space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-cyan-700" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Wallet</div>
            <div className="truncate text-xs text-[var(--app-muted)]">{walletAddress || 'Not connected'}</div>
          </div>
        </div>
        <button
          type="button"
          className="h-11 w-full rounded-lg border border-rose-600/30 font-medium text-rose-700"
          onClick={() => window.Telegram?.WebApp.sendData(JSON.stringify({ type: 'disconnect_wallet' }))}
        >
          Disconnect
        </button>
      </section>
    </div>
  )
}

function RiskSelect({ value, onValueChange }: { value: RiskAppetite; onValueChange: (value: RiskAppetite) => void }) {
  return (
    <Select.Root value={value} onValueChange={(next) => onValueChange(next as RiskAppetite)}>
      <Select.Trigger className="flex h-10 items-center gap-2 rounded-lg border border-black/10 px-3 text-sm font-medium capitalize">
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 rounded-lg border border-black/10 bg-[var(--app-panel)] p-1 shadow-xl">
          <Select.Viewport>
            {riskOptions.map((risk) => (
              <Select.Item key={risk} value={risk} className="cursor-pointer rounded-md px-3 py-2 capitalize outline-none data-[highlighted]:bg-emerald-600/10">
                <Select.ItemText>{risk}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function Toggle({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-3 py-3">
      <Bell className="h-5 w-5 text-amber-700" />
      <span className="flex-1 font-medium">{label}</span>
      <input className="h-5 w-5 accent-emerald-700" type="checkbox" defaultChecked={checked} />
    </label>
  )
}
