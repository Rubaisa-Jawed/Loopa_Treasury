import { and, asc, desc, eq } from 'drizzle-orm'
import type { RiskAppetite } from '@pilot/shared'
import { alerts, conversations, db, transactions, users, type Alert, type Conversation, type User } from './schema.js'
import { logger } from '../utils/logger.js'

export async function getUserByTelegramId(telegramId: number): Promise<User | undefined> {
  try {
    const rows = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
    return rows[0]
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to fetch user by Telegram id')
    return undefined
  }
}

export async function getUserById(userId: number): Promise<User | undefined> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    return rows[0]
  } catch (error) {
    logger.error({ error, userId }, 'Failed to fetch user by id')
    return undefined
  }
}

export async function getUsersWithWallets(): Promise<User[]> {
  try {
    const rows = await db.select().from(users)
    return rows.filter((user) => Boolean(user.walletAddress))
  } catch (error) {
    logger.error({ error }, 'Failed to fetch users with wallets')
    return []
  }
}

export async function createUser(telegramId: number, username?: string): Promise<User | undefined> {
  try {
    const inserted = await db
      .insert(users)
      .values({ telegramId, telegramUsername: username })
      .onConflictDoUpdate({
        target: users.telegramId,
        set: { telegramUsername: username }
      })
      .returning()

    return inserted[0]
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to create user')
    return undefined
  }
}

export async function updateUserWallet(userId: number, walletAddress: string): Promise<User | undefined> {
  try {
    const updated = await db.update(users).set({ walletAddress }).where(eq(users.id, userId)).returning()
    return updated[0]
  } catch (error) {
    logger.error({ error, userId }, 'Failed to update user wallet')
    return undefined
  }
}

export async function updateRiskAppetite(userId: number, riskAppetite: RiskAppetite): Promise<User | undefined> {
  try {
    const updated = await db.update(users).set({ riskAppetite }).where(eq(users.id, userId)).returning()
    return updated[0]
  } catch (error) {
    logger.error({ error, userId, riskAppetite }, 'Failed to update risk appetite')
    return undefined
  }
}

export async function updateNotificationPreference(
  userId: number,
  preference: 'dailySummaryEnabled' | 'largeMovesEnabled' | 'positionChangesEnabled',
  enabled: boolean
): Promise<User | undefined> {
  try {
    const updated = await db.update(users).set({ [preference]: enabled }).where(eq(users.id, userId)).returning()
    return updated[0]
  } catch (error) {
    logger.error({ error, userId, preference, enabled }, 'Failed to update notification preference')
    return undefined
  }
}

export async function getConversationHistory(userId: number, limit = 10): Promise<Conversation[]> {
  try {
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt))
      .limit(limit)

    return rows.reverse()
  } catch (error) {
    logger.error({ error, userId }, 'Failed to fetch conversation history')
    return []
  }
}

export async function saveConversation(userId: number, userMessage: string, agentResponse: string): Promise<void> {
  try {
    await db.insert(conversations).values([
      { userId, role: 'user', content: userMessage },
      { userId, role: 'assistant', content: agentResponse }
    ])
  } catch (error) {
    logger.error({ error, userId }, 'Failed to save conversation')
  }
}

export async function createAlert(
  userId: number,
  type: string,
  token: string,
  threshold: number,
  direction = type.endsWith('below') ? 'below' : 'above'
): Promise<Alert | undefined> {
  try {
    const inserted = await db
      .insert(alerts)
      .values({
        userId,
        type,
        token: token.toUpperCase(),
        threshold: threshold.toString(),
        direction
      })
      .returning()

    return inserted[0]
  } catch (error) {
    logger.error({ error, userId, token, threshold }, 'Failed to create alert')
    return undefined
  }
}

export async function getActiveAlerts(): Promise<Alert[]> {
  try {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.triggered, false)))
      .orderBy(asc(alerts.createdAt))
  } catch (error) {
    logger.error({ error }, 'Failed to fetch active alerts')
    return []
  }
}

export async function markAlertTriggered(alertId: number): Promise<void> {
  try {
    await db.update(alerts).set({ triggered: true }).where(eq(alerts.id, alertId))
  } catch (error) {
    logger.error({ error, alertId }, 'Failed to mark alert triggered')
  }
}

export async function createTransaction(userId: number, type: string, details: object): Promise<void> {
  try {
    await db.insert(transactions).values({ userId, type, details, status: 'pending' })
  } catch (error) {
    logger.error({ error, userId, type }, 'Failed to create transaction')
  }
}

export async function updateTransactionStatus(txSig: string, status: string): Promise<void> {
  try {
    await db.update(transactions).set({ txSignature: txSig, status }).where(eq(transactions.txSignature, txSig))
  } catch (error) {
    logger.error({ error, txSig, status }, 'Failed to update transaction status')
  }
}
