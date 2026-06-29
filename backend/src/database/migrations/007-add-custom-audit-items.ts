/**
 * 007-add-custom-audit-items.ts
 * Lets auditors add ad-hoc checkpoints to a section DURING an audit.
 *
 * Custom items live in audit_items but are scoped to a single audit via
 * created_in_audit_id, so they only appear in that audit (master checklist
 * untouched). The old UNIQUE(section_id, sr_no) is replaced by two partial
 * unique indexes so two different audits can each have e.g. item #17 in the
 * same section.
 *
 * Run:  npm run migrate:custom-items --workspace=backend
 */
import { db } from '../connection';
import { logger } from '../../utils/logger';

async function migrate() {
  try {
    await db.query(`ALTER TABLE audit_items ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false`);
    await db.query(`ALTER TABLE audit_items ADD COLUMN IF NOT EXISTS created_in_audit_id INTEGER`);
    await db.query(`ALTER TABLE audit_items ADD COLUMN IF NOT EXISTS created_by INTEGER`);
    await db.query(`ALTER TABLE audit_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    // Replace the blanket (section_id, sr_no) uniqueness with scope-aware ones.
    await db.query(`ALTER TABLE audit_items DROP CONSTRAINT IF EXISTS audit_items_section_id_sr_no_key`);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_items_master_srno
      ON audit_items (section_id, sr_no) WHERE is_custom = false`);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_items_custom_srno
      ON audit_items (created_in_audit_id, section_id, sr_no) WHERE is_custom = true`);

    logger.info('Migration 007 complete: audit_items supports per-audit custom checkpoints');
    process.exit(0);
  } catch (error) {
    logger.error('Migration 007 failed:', error);
    process.exit(1);
  }
}

migrate();
