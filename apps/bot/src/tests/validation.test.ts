import assert from 'node:assert/strict'
import { Keypair } from '@solana/web3.js'
import { TOKEN_MINTS, tokenSymbolToMint } from '@pilot/shared'
import { amountToAtomic, atomicToAmount } from '../solana/jupiter.js'
import { validateSolanaAddress } from '../solana/wallet.js'
import { parsePrepareSwapInput, parseYieldSearchInput } from '../agent/tools/validation.js'

function run(): void {
  const walletAddress = Keypair.generate().publicKey.toBase58()

  assert.equal(validateSolanaAddress(walletAddress), true)
  assert.equal(validateSolanaAddress('not-a-wallet'), false)

  assert.equal(tokenSymbolToMint('SOL'), TOKEN_MINTS.SOL)
  assert.equal(amountToAtomic(1.25, 'SOL'), '1250000000')
  assert.equal(atomicToAmount('1250000000', 'SOL'), 1.25)

  assert.deepEqual(parseYieldSearchInput({ token: 'USDC', riskAppetite: 'balanced' }), {
    token: 'USDC',
    riskAppetite: 'balanced'
  })

  assert.doesNotThrow(() =>
    parsePrepareSwapInput({
      fromToken: 'SOL',
      toToken: 'USDC',
      amount: 0.5,
      walletAddress
    })
  )

  assert.throws(() =>
    parsePrepareSwapInput({
      fromToken: 'SOL',
      toToken: 'SOL',
      amount: 0.5,
      walletAddress
    })
  )

  assert.throws(() =>
    parsePrepareSwapInput({
      fromToken: 'SOL',
      toToken: 'USDC',
      amount: -1,
      walletAddress
    })
  )

  assert.throws(() =>
    parsePrepareSwapInput({
      fromToken: 'SOL',
      toToken: 'USDC',
      amount: 1,
      walletAddress: 'invalid'
    })
  )
}

run()
console.log('Validation tests passed')
