import { db } from '../connection';
import { logger } from '../../utils/logger';

async function migrate() {
  try {
    logger.info('Adding password_changed_at column to users table...');

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP
    `);

    logger.info('password_changed_at column added successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
