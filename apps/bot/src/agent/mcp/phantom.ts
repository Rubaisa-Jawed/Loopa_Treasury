import { asRecord, asString } from '../../utils/http.js'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'
import { callMcpTool } from './client.js'

export async function signAndSendWithPhantom(serializedTransaction: string): Promise<string> {
  try {
    if (!env.PHANTOM_MCP_SERVER_URL) {
      throw new Error('PHANTOM_MCP_SERVER_URL is not configured')
    }

    const result = await callMcpTool(env.PHANTOM_MCP_SERVER_URL, 'signAndSendTransaction', {
      transaction: serializedTransaction,
      encoding: 'base64'
    })

    const record = asRecord(result)
    const signature = asString(record?.signature ?? record?.txSignature ?? record?.transactionSignature)

    if (!signature) {
      throw new Error('Phantom MCP did not return a transaction signature')
    }

    logger.info({ signature }, 'Phantom MCP signed and sent transaction')
    return signature
  } catch (error) {
    logger.error({ error }, 'Phantom MCP signing failed')
    throw error
  }
}
