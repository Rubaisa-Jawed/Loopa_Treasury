import { logger } from './logger.js'

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init)
    const text = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 500)}`)
    }

    return JSON.parse(text) as T
  } catch (error) {
    logger.error({ error, url }, 'HTTP JSON request failed')
    throw error
  }
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return undefined
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
