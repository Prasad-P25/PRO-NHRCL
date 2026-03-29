import { db } from '../connection';
import { logger } from '../../utils/logger';

async function migrate() {
  try {
    logger.info('Adding password reset columns to users table...');

    // Add password reset columns
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP
    `);

    // Create index for faster token lookup
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL
    `);

    logger.info('Password reset columns added successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
