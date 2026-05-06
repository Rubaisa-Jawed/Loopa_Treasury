import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import type { RiskAppetite } from '@pilot/shared'
import { isSupportedTokenSymbol } from '@pilot/shared'

const solanaAddressSchema = z.string().trim().refine((value) => {
  try {
    new PublicKey(value)
    return true
  } catch {
    return false
  }
}, 'Expected a valid Solana public key')

const tokenIdentifierSchema = z.string().trim().min(2).refine((value) => {
  if (isSupportedTokenSymbol(value.toUpperCase())) {
    return true
  }

  try {
    new PublicKey(value)
    return true
  } catch {
    return false
  }
}, 'Expected a supported token symbol or mint address')

const humanAmountSchema = z.number().finite().positive().max(1_000_000)

export const prepareSwapSchema = z
  .object({
    fromToken: tokenIdentifierSchema,
    toToken: tokenIdentifierSchema,
    amount: humanAmountSchema,
    walletAddress: solanaAddressSchema,
    quoteOnly: z.boolean().optional()
  })
  .refine((value) => value.fromToken.trim().toUpperCase() !== value.toToken.trim().toUpperCase(), {
    message: 'Swap input and output tokens must be different',
    path: ['toToken']
  })

export const yieldSearchSchema = z.object({
  token: tokenIdentifierSchema,
  amount: humanAmountSchema.optional(),
  riskAppetite: z.enum(['conservative', 'balanced', 'aggressive'])
})

export function parsePrepareSwapInput(input: unknown): z.infer<typeof prepareSwapSchema> {
  return prepareSwapSchema.parse(input)
}

export function parseYieldSearchInput(input: unknown): {
  token: string
  amount?: number
  riskAppetite: RiskAppetite
} {
  return yieldSearchSchema.parse(input)
}
