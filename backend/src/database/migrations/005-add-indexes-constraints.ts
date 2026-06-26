import { db } from '../connection';
import { logger } from '../../utils/logger';

/**
 * Additive patch for an existing (live) database. Everything here is written to
 * be safe to run against real data:
 *  - indexes use IF NOT EXISTS
 *  - CHECK constraints are added NOT VALID so legacy rows that violate them are
 *    not rejected; the constraint is still enforced on all new writes
 *  - the partial-unique "one default project per user" index is created only if
 *    no user currently has more than one default (otherwise it is skipped with a
 *    warning, since creating it would fail)
 */
const patch = `
-- Missing indexes on FK columns and hot filters
CREATE INDEX IF NOT EXISTS idx_users_package_id ON users(package_id);
CREATE INDEX IF NOT EXISTS idx_audit_responses_item_id ON audit_responses(audit_item_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidences_response_id ON audit_evidences(response_id);
CREATE INDEX IF NOT EXISTS idx_capa_response_id ON capa(response_id);
CREATE INDEX IF NOT EXISTS idx_capa_target_date ON capa(target_date) WHERE status != 'Closed';
CREATE INDEX IF NOT EXISTS idx_kpi_entries_period ON kpi_entries(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_kpi_entries_indicator ON kpi_entries(indicator_id);
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_package ON maturity_assessments(package_id);
CREATE INDEX IF NOT EXISTS idx_maturity_responses_assessment ON maturity_responses(assessment_id);

-- capa.updated_at column used by the close/update path
ALTER TABLE capa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Status / priority CHECK constraints, added NOT VALID so existing rows pass
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_audits_status') THEN
        ALTER TABLE audits ADD CONSTRAINT chk_audits_status
            CHECK (status IN ('Draft', 'In Progress', 'Pending Review', 'Approved', 'Rejected')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_audit_responses_status') THEN
        ALTER TABLE audit_responses ADD CONSTRAINT chk_audit_responses_status
            CHECK (status IN ('C', 'NC', 'NA', 'NV', 'RM')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_capa_status') THEN
        ALTER TABLE capa ADD CONSTRAINT chk_capa_status
            CHECK (status IN ('Open', 'In Progress', 'Closed')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_maturity_status') THEN
        ALTER TABLE maturity_assessments ADD CONSTRAINT chk_maturity_status
            CHECK (status IN ('Draft', 'In Progress', 'Completed', 'Submitted')) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_audit_items_priority') THEN
        ALTER TABLE audit_items ADD CONSTRAINT chk_audit_items_priority
            CHECK (priority IN ('P1', 'P2', 'P3')) NOT VALID;
    END IF;
END $$;

-- Switch capa.response_id to ON DELETE SET NULL (was NO ACTION, which blocks
-- deleting an audit response that has a CAPA)
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'capa'::regclass
      AND contype = 'f'
      AND confrelid = 'audit_responses'::regclass
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE capa DROP CONSTRAINT ' || quote_ident(fk_name);
    END IF;

    ALTER TABLE capa
        ADD CONSTRAINT capa_response_id_fkey
        FOREIGN KEY (response_id) REFERENCES audit_responses(id) ON DELETE SET NULL;
END $$;
`;

async function migrate() {
  try {
    logger.info('Applying indexes and constraints patch...');

    await db.query(patch);

    // The "one default project per user" unique index can only be created if no
    // user currently violates it. Check first, then create or skip.
    const dupes = await db.query(`
      SELECT user_id FROM user_project_assignments
      WHERE is_default = true
      GROUP BY user_id HAVING COUNT(*) > 1
    `);

    if (dupes.rows.length === 0) {
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_project_one_default
        ON user_project_assignments(user_id) WHERE is_default
      `);
      logger.info('Created one-default-project-per-user unique index.');
    } else {
      logger.warn(
        `Skipped one-default-project unique index: ${dupes.rows.length} user(s) have multiple default projects. Resolve duplicates then create the index manually.`
      );
    }

    logger.info('Patch completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Patch migration failed:', error);
    process.exit(1);
  }
}

migrate();
