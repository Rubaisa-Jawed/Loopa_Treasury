import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface ConfirmDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: {
    from: string
    to: string
    amount: string
    expectedOutput: string
    priceImpact: number
    fee: string
  }
  onConfirm: () => void
}

export default function ConfirmDrawer({ open, onOpenChange, summary, onConfirm }: ConfirmDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl rounded-t-2xl bg-[var(--app-panel)] p-4 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Confirm swap</Dialog.Title>
            <Dialog.Close className="rounded-lg p-2 text-[var(--app-muted)]" aria-label="Close" title="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <dl className="space-y-3 text-sm">
            <Row label="Send" value={`${summary.amount} ${summary.from}`} />
            <Row label="Receive" value={`~${summary.expectedOutput} ${summary.to}`} />
            <Row
              label="Price impact"
              value={`${summary.priceImpact.toFixed(2)}%`}
              danger={summary.priceImpact > 1}
            />
            <Row label="Fee" value={summary.fee} />
          </dl>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Dialog.Close className="h-12 rounded-lg border border-black/10 font-medium">Cancel</Dialog.Close>
            <button type="button" className="tg-button h-12 rounded-lg font-semibold" onClick={onConfirm}>
              Confirm
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Row({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--app-muted)]">{label}</dt>
      <dd className={`font-medium ${danger ? 'text-rose-600' : ''}`}>{value}</dd>
    </div>
  )
}
