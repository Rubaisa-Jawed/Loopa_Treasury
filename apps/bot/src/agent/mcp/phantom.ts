import { env } from '../../utils/env.js'
import { asRecord, asString } from '../../utils/http.js'
import { logger } from '../../utils/logger.js'
import { extractText, StdioMcpClient } from './client.js'

interface PhantomAddress {
  addressType: string
  address: string
}

interface PhantomWalletInfo {
  walletId?: string
  solanaAddress: string
  addresses: PhantomAddress[]
}

interface PhantomSimulation {
  blocked: boolean
  summary: string
  raw: unknown
}

interface PhantomSendResult {
  signature: string
  raw: unknown
}

let phantomClient: StdioMcpClient | undefined

export function getPhantomMcpClient(): StdioMcpClient {
  if (!phantomClient) {
    phantomClient = new StdioMcpClient({
      name: 'phantom',
      command: phantomCommand(),
      args: phantomArgs()
    })
  }

  return phantomClient
}

export async function getPhantomConnectionStatus(): Promise<string> {
  const result = await callPhantomTool(['wallet_status', 'get_connection_status'])
  return result.text || JSON.stringify(result.structuredContent ?? result.raw)
}

export async function getPhantomWalletInfo(): Promise<PhantomWalletInfo> {
  const result = await callPhantomTool(['wallet_addresses', 'get_wallet_addresses'])
  const record = result.structuredContent ?? parseJsonText(result.text) ?? asRecord(result.raw) ?? {}
  const addresses = extractAddresses(record, result.text)
  const walletId = asString(record.walletId)
  const solanaAddress = addresses.find((address) => /solana/i.test(address.addressType))?.address

  if (!solanaAddress) {
    throw new Error(
      'Phantom MCP is connected, but no Solana agent wallet address was returned. Run /phantom again after authentication.'
    )
  }

  return {
    walletId,
    solanaAddress,
    addresses
  }
}

export async function assertPhantomWalletMatches(expectedWalletAddress: string): Promise<PhantomWalletInfo> {
  const info = await getPhantomWalletInfo()
  if (info.solanaAddress !== expectedWalletAddress) {
    throw new Error(
      [
        'The connected Telegram wallet is watch-only and does not match the Phantom MCP agent wallet.',
        `Telegram wallet: ${expectedWalletAddress}`,
        `Phantom MCP wallet: ${info.solanaAddress}`,
        'For executable MCP testing, run /phantom, fund the Phantom MCP wallet with a tiny amount, then tap "Use MCP wallet for tests".'
      ].join('\n')
    )
  }

  return info
}

export async function simulateSolanaTransactionWithPhantom(
  serializedTransaction: string,
  networkId = env.PHANTOM_MCP_NETWORK_ID
): Promise<PhantomSimulation> {
  const result = await callPhantomTool(['solana_send', 'send_solana_transaction'], {
    transaction: serializedTransaction,
    networkId
  })
  const combined = combineResult(result.raw, result.text)
  const block = findDeep(combined, 'block')
  const blocked = Boolean(block && block !== null)
  const summary = summarizeSimulation(result.text, combined)

  logger.info({ blocked, summary }, 'Phantom MCP transaction simulation completed')
  return {
    blocked,
    summary,
    raw: combined
  }
}

export async function sendSolanaTransactionWithPhantom(
  serializedTransaction: string,
  networkId = env.PHANTOM_MCP_NETWORK_ID
): Promise<PhantomSendResult> {
  const result = await callPhantomTool(['solana_send', 'send_solana_transaction'], {
    transaction: serializedTransaction,
    networkId,
    confirmed: true
  })
  const combined = combineResult(result.raw, result.text)
  const signature = findSignature(combined, result.text)

  if (!signature) {
    throw new Error(`Phantom MCP sent the transaction but did not return a signature. Response: ${result.text}`)
  }

  logger.info({ signature }, 'Phantom MCP signed and sent Solana transaction')
  return {
    signature,
    raw: combined
  }
}

export async function closePhantomMcp(): Promise<void> {
  await phantomClient?.close()
  phantomClient = undefined
}

async function callPhantomTool(
  names: string[],
  args: Record<string, unknown> = {}
): ReturnType<StdioMcpClient['callTool']> {
  const client = getPhantomMcpClient()
  const tools = await client.listTools()
  const name = names.find((candidate) => tools.includes(candidate))

  if (!name) {
    throw new Error(`Phantom MCP does not expose any of these tools: ${names.join(', ')}. Available tools: ${tools.join(', ')}`)
  }

  return client.callTool(name, args)
}

function phantomCommand(): string {
  if (env.PHANTOM_MCP_COMMAND) {
    return env.PHANTOM_MCP_COMMAND
  }

  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function phantomArgs(): string[] {
  if (!env.PHANTOM_MCP_ARGS) {
    return ['-y', '@phantom/mcp-server@latest']
  }

  return env.PHANTOM_MCP_ARGS.split(/\s+/).filter(Boolean)
}

function parseJsonText(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text) as unknown
    return asRecord(parsed)
  } catch {
    return undefined
  }
}

function extractAddresses(record: Record<string, unknown>, text: string): PhantomAddress[] {
  const fromRecord = record.addresses
  if (Array.isArray(fromRecord)) {
    return fromRecord
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        addressType: asString(item.addressType ?? item.type ?? item.chain) ?? 'unknown',
        address: asString(item.address) ?? ''
      }))
      .filter((item) => item.address.length > 0)
  }

  const solanaMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)
  return solanaMatch ? [{ addressType: 'Solana', address: solanaMatch[0] }] : []
}

function combineResult(raw: unknown, text: string): unknown {
  const rawRecord = asRecord(raw)
  if (rawRecord?.structuredContent) {
    return rawRecord.structuredContent
  }

  return parseJsonText(text) ?? raw
}

function summarizeSimulation(text: string, value: unknown): string {
  const status = findDeep(value, 'status')
  const simulation = findDeep(value, 'simulation')
  if (status === 'pending_confirmation' && simulation === null) {
    return 'Phantom accepted the transaction request. Simulation details were not returned, so review the quote and use the final approval button only when you are ready to broadcast.'
  }

  const block = findDeep(value, 'block')
  if (block) {
    const message = findDeep(block, 'message')
    return typeof message === 'string' ? `Blocked: ${message}` : 'Blocked by Phantom transaction simulation.'
  }

  const warnings = findDeep(value, 'warnings')
  if (Array.isArray(warnings) && warnings.length > 0) {
    const first = asRecord(warnings[0])
    const message = asString(first?.message)
    return message ? `Warning: ${message}` : 'Simulation returned warnings.'
  }

  if (text.trim().length > 0) {
    return text.trim().slice(0, 500)
  }

  return 'Phantom simulation completed with no blocking warnings.'
}

function findSignature(value: unknown, text: string): string | undefined {
  const keys = ['signature', 'txSignature', 'transactionSignature', 'transactionHash', 'hash']
  for (const key of keys) {
    const found = findDeep(value, key)
    if (typeof found === 'string' && found.length >= 32) {
      return found
    }
  }

  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{64,88}/)
  return match?.[0]
}

function findDeep(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const record = value as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key]
  }

  for (const item of Object.values(record)) {
    if (Array.isArray(item)) {
      for (const entry of item) {
        const found = findDeep(entry, key)
        if (found !== undefined) return found
      }
    } else {
      const found = findDeep(item, key)
      if (found !== undefined) return found
    }
  }

  return undefined
}

export function phantomResultToText(value: unknown): string {
  const text = extractText(value)
  return text || JSON.stringify(value, null, 2)
}
