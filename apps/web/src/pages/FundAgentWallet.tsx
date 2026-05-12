import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Send, Wallet } from 'lucide-react'

interface FundAgentWalletProps {
  walletAddress: string
  amount: string
}

export default function FundAgentWallet({ walletAddress, amount }: FundAgentWalletProps) {
  const [copied, setCopied] = useState(false)
  const solanaPayUrl = useMemo(() => {
    const url = new URL(`solana:${walletAddress}`)
    url.searchParams.set('amount', amount)
    url.searchParams.set('label', 'LoopTreasury Agent Wallet')
    url.searchParams.set('message', 'Fund LoopTreasury live test wallet')
    return url.toString()
  }, [amount, walletAddress])
  const phantomUrl = useMemo(() => {
    const current = window.location.href
    return `https://phantom.app/ul/browse/${encodeURIComponent(current)}?ref=${encodeURIComponent(window.location.origin)}`
  }, [])

  const copyAddress = async () => {
    await navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#147d64] text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Fund agent wallet</h1>
          <p className="text-sm text-[var(--app-muted)]">Mainnet live test balance</p>
        </div>
      </header>

      <section className="panel p-4">
        <div className="text-sm text-[var(--app-muted)]">Send exactly this amount for the demo test</div>
        <div className="mt-1 text-3xl font-semibold mono-tabular">{amount} SOL</div>
      </section>

      <section className="panel p-4">
        <div className="text-sm text-[var(--app-muted)]">Agent wallet address</div>
        <div className="mt-2 break-all rounded-md border border-[var(--app-border)] bg-black/5 p-3 font-mono text-sm">
          {walletAddress}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="tg-button flex h-11 items-center justify-center gap-2 rounded-lg" onClick={copyAddress}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <a className="tg-button flex h-11 items-center justify-center gap-2 rounded-lg" href={solanaPayUrl}>
            <Send className="h-4 w-4" />
            <span>Send SOL</span>
          </a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <a className="panel flex h-12 items-center justify-center gap-2 text-sm" href={phantomUrl}>
          <Wallet className="h-4 w-4" />
          <span>Open Phantom</span>
        </a>
        <a
          className="panel flex h-12 items-center justify-center gap-2 text-sm"
          href={`https://solscan.io/account/${walletAddress}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Solscan</span>
        </a>
      </section>

      <p className="text-sm leading-6 text-[var(--app-muted)]">
        After the transfer confirms, return to Telegram and tap Refresh balance in /phantom.
      </p>
    </main>
  )
}
