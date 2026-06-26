/**
 * 006-add-removed-status.ts
 * Adds the 'RM' (Removed) status to audit_responses.
 *
 * "Remove" is a per-audit, reversible auditor action that excludes a checkpoint
 * from this audit's reports and compliance math. It is stored as a response
 * status so the existing audit_response_history table records the change
 * (e.g. NC -> RM), keeping removals visible/accountable to the reviewer.
 *
 * Run:  npm run migrate:removed-status --workspace=backend
 */
import { db } from '../connection';
import { logger } from '../../utils/logger';

async function migrate() {
  try {
    // There are TWO CHECK constraints on audit_responses.status:
    //  1. audit_responses_status_check  - the inline one from migrate.ts
    //  2. chk_audit_responses_status    - the NOT VALID one from migration 005
    // Both must allow 'RM' or inserts/updates with status='RM' are rejected.
    await db.query(`ALTER TABLE audit_responses DROP CONSTRAINT IF EXISTS audit_responses_status_check`);
    await db.query(
      `ALTER TABLE audit_responses
       ADD CONSTRAINT audit_responses_status_check
       CHECK (status IN ('C', 'NC', 'NA', 'NV', 'RM'))`
    );

    await db.query(`ALTER TABLE audit_responses DROP CONSTRAINT IF EXISTS chk_audit_responses_status`);
    await db.query(
      `ALTER TABLE audit_responses
       ADD CONSTRAINT chk_audit_responses_status
       CHECK (status IN ('C', 'NC', 'NA', 'NV', 'RM')) NOT VALID`
    );

    logger.info("Migration 006 complete: both audit_responses status constraints now allow 'RM' (Removed)");
    process.exit(0);
  } catch (error) {
    logger.error('Migration 006 failed:', error);
    process.exit(1);
  }
}

migrate();
