import { randomUUID } from 'node:crypto'
import { fetchJson } from '../../utils/http.js'
import { logger } from '../../utils/logger.js'

interface McpToolResponse {
  result?: unknown
  error?: {
    code?: number
    message?: string
  }
}

export async function callMcpTool(serverUrl: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const response = await fetchJson<McpToolResponse>(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      })
    })

    if (response.error) {
      throw new Error(response.error.message ?? `MCP error ${response.error.code ?? 'unknown'}`)
    }

    return response.result
  } catch (error) {
    logger.error({ error, toolName }, 'MCP tool call failed')
    throw error
  }
}
