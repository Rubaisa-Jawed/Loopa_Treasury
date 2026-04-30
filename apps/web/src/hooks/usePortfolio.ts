import { usePilotStore } from '../store/index.js'

export function usePortfolio() {
  return usePilotStore((state) => state.portfolio)
}
