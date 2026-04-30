import { drizzle } from 'drizzle-orm/postgres-js'
import {
  bigint,
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp
} from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).unique().notNull(),
  telegramUsername: text('telegram_username'),
  walletAddress: text('wallet_address'),
  privyUserId: text('privy_user_id'),
  riskAppetite: text('risk_appetite').notNull().default('balanced'),
  monitoringFrequency: text('monitoring_frequency').notNull().default('4h'),
  dailySummaryEnabled: boolean('daily_summary_enabled').notNull().default(true),
  largeMovesEnabled: boolean('large_moves_enabled').notNull().default(true),
  positionChangesEnabled: boolean('position_changes_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  type: text('type').notNull(),
  token: text('token').notNull(),
  threshold: decimal('threshold', { precision: 18, scale: 8 }).notNull(),
  direction: text('direction').notNull().default('above'),
  triggered: boolean('triggered').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  txSignature: text('tx_signature').unique(),
  type: text('type').notNull(),
  details: jsonb('details'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Alert = typeof alerts.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type Conversation = typeof conversations.$inferSelect

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
})

export const db = drizzle(sql)

export async function closeDb(): Promise<void> {
  try {
    await sql.end({ timeout: 5 })
  } catch (error) {
    logger.error({ error }, 'Failed to close database connection')
  }
}
