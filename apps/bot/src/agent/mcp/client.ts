import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { logger } from '../../utils/logger.js'

export interface McpServerConfig {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface McpToolCallResult {
  structuredContent?: Record<string, unknown>
  text: string
  raw: unknown
}

export class StdioMcpClient {
  private client?: Client
  private transport?: StdioClientTransport
  private toolNames?: Set<string>
  private readonly stderrLines: string[] = []

  constructor(private readonly config: McpServerConfig) {}

  async connect(): Promise<void> {
    if (this.client) return

    try {
      const transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
        stderr: 'pipe'
      })
      transport.onerror = (error) => {
        logger.error({ error, server: this.config.name }, 'MCP transport error')
      }
      transport.stderr?.on('data', (chunk: Buffer) => {
        const stderr = chunk.toString('utf8')
        this.stderrLines.push(stderr)
        if (this.stderrLines.length > 20) {
          this.stderrLines.shift()
        }
        logger.debug({ server: this.config.name, stderr }, 'MCP server stderr')
      })

      const client = new Client({
        name: 'looptreasury-bot',
        version: '0.1.0'
      })

      await client.connect(transport)
      this.client = client
      this.transport = transport
      logger.info({ server: this.config.name }, 'MCP client connected')
    } catch (error) {
      this.client = undefined
      this.transport = undefined
      logger.error({ error, server: this.config.name }, 'Failed to connect MCP client')
      throw error
    }
  }

  async listTools(): Promise<string[]> {
    await this.connect()
    if (!this.client) throw new Error('MCP client is not connected')

    if (!this.toolNames) {
      const result = await this.client.listTools()
      this.toolNames = new Set(result.tools.map((tool) => tool.name))
    }

    return Array.from(this.toolNames)
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolCallResult> {
    await this.connect()
    if (!this.client) throw new Error('MCP client is not connected')

    const tools = await this.listTools()
    if (!tools.includes(name)) {
      throw new Error(`MCP tool "${name}" is not available. Available tools: ${tools.join(', ')}`)
    }

    let raw: unknown
    try {
      raw = await this.client.callTool({
        name,
        arguments: args
      })
    } catch (error) {
      const hint = this.authHint()
      const message = error instanceof Error ? error.message : 'MCP tool call failed'
      throw new Error(hint ? `${message}\n\n${hint}` : message)
    }

    const record = asMcpResultRecord(raw)
    if (record.isError) {
      throw new Error(extractText(raw) || `MCP tool "${name}" failed`)
    }

    logger.info({ tool: name, server: this.config.name }, 'MCP tool call completed')
    return {
      structuredContent: record.structuredContent,
      text: extractText(raw),
      raw
    }
  }

  async close(): Promise<void> {
    await this.transport?.close()
    this.client = undefined
    this.transport = undefined
    this.toolNames = undefined
    this.stderrLines.length = 0
  }

  private authHint(): string | undefined {
    const stderr = this.stderrLines.join('\n')
    const url = stderr.match(/https:\/\/connect\.phantom\.app\/device-connect\?[^\s\u0007]+/)?.[0]
    const code = stderr.match(/Code:\s+([A-Za-z0-9]+)/)?.[1] ?? stderr.match(/user_code=([A-Za-z0-9]+)/)?.[1]

    if (!url && !code) {
      return undefined
    }

    return [
      'Phantom MCP is waiting for device authorization.',
      'Signing in with Google or Apple is expected for this Phantom embedded agent wallet.',
      url ? `Open this link on this desktop browser: ${url}` : undefined,
      code ? `Device code: ${code}` : undefined
    ]
      .filter(Boolean)
      .join('\n')
  }
}

function asMcpResultRecord(value: unknown): {
  structuredContent?: Record<string, unknown>
  isError?: boolean
} {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const record = value as Record<string, unknown>
  return {
    structuredContent:
      typeof record.structuredContent === 'object' && record.structuredContent !== null
        ? (record.structuredContent as Record<string, unknown>)
        : undefined,
    isError: typeof record.isError === 'boolean' ? record.isError : undefined
  }
}

export function extractText(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return ''
  }

  const record = value as Record<string, unknown>
  const content = record.content
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((item) => {
      if (typeof item !== 'object' || item === null) return ''
      const contentRecord = item as Record<string, unknown>
      return typeof contentRecord.text === 'string' ? contentRecord.text : ''
    })
    .filter(Boolean)
    .join('\n')
}
