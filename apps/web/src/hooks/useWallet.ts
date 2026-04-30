import { useEffect } from 'react'
import { usePilotStore } from '../store/index.js'

export function useWallet(): string {
  const walletAddress = usePilotStore((state) => state.walletAddress)
  const setWalletAddress = usePilotStore((state) => state.setWalletAddress)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wallet = params.get('wallet')
    if (wallet) {
      setWalletAddress(wallet)
    }
  }, [setWalletAddress])

  return walletAddress
}
