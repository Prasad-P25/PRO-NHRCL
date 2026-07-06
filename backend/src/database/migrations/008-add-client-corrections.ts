/**
 * 008-add-client-corrections.ts
 * Client Rectification Portal (Phase 1).
 *
 * Adds:
 *  - a "Client" role (scoped to one package via users.package_id) so a client can
 *    log in and see ONLY their package's Non-Compliance items,
 *  - a rectification review flow on each CAPA: the client uploads fix photos and
 *    submits; an auditor then Approves (which closes the CAPA) or Rejects (sends
 *    it back). Tracked separately from the main CAPA `status` so existing CAPA
 *    analytics/close logic is untouched,
 *  - capa_evidences: the client's "after / fixed" photos (kept separate from the
 *    auditor's original audit_evidences "before / problem" photos).
 *
 * Idempotent (IF NOT EXISTS / ON CONFLICT) and non-destructive — safe on prod.
 *
 * Run:  npx ts-node src/database/migrations/008-add-client-corrections.ts
 */
import { db } from '../connection';
import { logger } from '../../utils/logger';

async function migrate() {
  try {
    // 1. Client role (package-scoped; permissions JSONB is descriptive only —
    //    real enforcement is by role name in middleware + package scoping in SQL).
    await db.query(`
      INSERT INTO roles (name, permissions)
      VALUES ('Client', '{"corrections": ["view", "submit"]}')
      ON CONFLICT (name) DO NOTHING
    `);

    // 2. Rectification review flow on CAPA.
    await db.query(`
      ALTER TABLE capa ADD COLUMN IF NOT EXISTS rectification_status VARCHAR(20)
        NOT NULL DEFAULT 'To Fix'
    `);
    // Add the CHECK separately so re-runs don't error if it already exists.
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'capa_rectification_status_check'
        ) THEN
          ALTER TABLE capa ADD CONSTRAINT capa_rectification_status_check
            CHECK (rectification_status IN ('To Fix', 'Submitted', 'Approved', 'Rejected'));
        END IF;
      END $$;
    `);
    await db.query(`ALTER TABLE capa ADD COLUMN IF NOT EXISTS rectification_submitted_at TIMESTAMP`);
    await db.query(`ALTER TABLE capa ADD COLUMN IF NOT EXISTS rectification_reviewed_by INTEGER REFERENCES users(id)`);
    await db.query(`ALTER TABLE capa ADD COLUMN IF NOT EXISTS rectification_reviewed_at TIMESTAMP`);
    await db.query(`ALTER TABLE capa ADD COLUMN IF NOT EXISTS rectification_review_note TEXT`);

    // 3. Client "fixed" photos (separate from auditor's original evidence).
    await db.query(`
      CREATE TABLE IF NOT EXISTS capa_evidences (
        id SERIAL PRIMARY KEY,
        capa_id INTEGER NOT NULL REFERENCES capa(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        note TEXT,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_capa_evidences_capa_id ON capa_evidences(capa_id)`);

    logger.info('Migration 008 complete: Client role + CAPA rectification flow + capa_evidences');
    process.exit(0);
  } catch (error) {
    logger.error('Migration 008 failed:', error);
    process.exit(1);
  }
}

migrate();
