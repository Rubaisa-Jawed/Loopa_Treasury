import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql, closeDb } from './schema.js'
import { logger } from '../utils/logger.js'

async function migrate(): Promise<void> {
  try {
    const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url))
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()

    for (const file of files) {
      const contents = await readFile(join(migrationsDir, file), 'utf8')
      await sql.unsafe(contents)
      logger.info({ file }, 'Applied migration')
    }
  } catch (error) {
    logger.error({ error }, 'Database migration failed')
    process.exitCode = 1
  } finally {
    await closeDb()
  }
}

void migrate()
