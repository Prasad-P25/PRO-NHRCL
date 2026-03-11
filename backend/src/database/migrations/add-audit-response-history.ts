import { db } from '../connection';
import { logger } from '../../utils/logger';

const migration = `
-- Audit Response History table for tracking all changes
CREATE TABLE IF NOT EXISTS audit_response_history (
    id SERIAL PRIMARY KEY,
    response_id INTEGER REFERENCES audit_responses(id) ON DELETE CASCADE,
    audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
    audit_item_id INTEGER,
    action VARCHAR(20) NOT NULL, -- 'created', 'updated', 'deleted'
    old_status VARCHAR(5),
    new_status VARCHAR(5),
    old_observation TEXT,
    new_observation TEXT,
    old_risk_rating VARCHAR(20),
    new_risk_rating VARCHAR(20),
    old_capa_required BOOLEAN,
    new_capa_required BOOLEAN,
    old_remarks TEXT,
    new_remarks TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_by_name VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_response_history_response ON audit_response_history(response_id);
CREATE INDEX IF NOT EXISTS idx_response_history_audit ON audit_response_history(audit_id);
CREATE INDEX IF NOT EXISTS idx_response_history_changed_at ON audit_response_history(changed_at DESC);

-- Add locked_at column to audits table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'audits' AND column_name = 'locked_at') THEN
        ALTER TABLE audits ADD COLUMN locked_at TIMESTAMP;
    END IF;
END $$;
`;

async function runMigration() {
  try {
    logger.info('Running migration: add-audit-response-history...');

    await db.query(migration);

    logger.info('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
