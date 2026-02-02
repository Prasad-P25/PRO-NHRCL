import { db } from './connection';
import { logger } from '../utils/logger';

async function cleanupDuplicates() {
  try {
    logger.info('Starting duplicate cleanup...');

    // 1. Find and remove duplicate audit_sections
    // Keep the one with lowest ID, update items to point to it, then delete duplicates
    logger.info('Cleaning up duplicate audit_sections...');

    // First, find all duplicate section groups
    const duplicateSections = await db.query(`
      SELECT category_id, code, MIN(id) as keep_id, array_agg(id) as all_ids
      FROM audit_sections
      GROUP BY category_id, code
      HAVING COUNT(*) > 1
    `);

    for (const row of duplicateSections.rows) {
      const keepId = row.keep_id;
      const duplicateIds = row.all_ids.filter((id: number) => id !== keepId);

      if (duplicateIds.length > 0) {
        // Update audit_items to point to the kept section
        await db.query(`
          UPDATE audit_items
          SET section_id = $1
          WHERE section_id = ANY($2)
        `, [keepId, duplicateIds]);

        // Delete duplicate sections
        await db.query(`
          DELETE FROM audit_sections WHERE id = ANY($1)
        `, [duplicateIds]);

        logger.info(`Cleaned up ${duplicateIds.length} duplicate sections for category ${row.category_id}, code ${row.code}`);
      }
    }

    // 2. Remove duplicate audit_items (same section_id and sr_no)
    logger.info('Cleaning up duplicate audit_items...');

    const duplicateItems = await db.query(`
      SELECT section_id, sr_no, MIN(id) as keep_id, array_agg(id) as all_ids
      FROM audit_items
      GROUP BY section_id, sr_no
      HAVING COUNT(*) > 1
    `);

    for (const row of duplicateItems.rows) {
      const keepId = row.keep_id;
      const duplicateIds = row.all_ids.filter((id: number) => id !== keepId);

      if (duplicateIds.length > 0) {
        // Get the response IDs that will be deleted (for updating CAPA references)
        const responsesToDelete = await db.query(`
          SELECT ar1.id as delete_id, ar2.id as keep_id
          FROM audit_responses ar1
          JOIN audit_responses ar2 ON ar2.audit_id = ar1.audit_id AND ar2.audit_item_id = $2
          WHERE ar1.audit_item_id = ANY($1)
        `, [duplicateIds, keepId]);

        // Update CAPA references to point to the kept response
        for (const resp of responsesToDelete.rows) {
          await db.query(`
            UPDATE capa SET response_id = $1 WHERE response_id = $2
          `, [resp.keep_id, resp.delete_id]);
        }

        // Delete audit evidences for responses that will be deleted
        await db.query(`
          DELETE FROM audit_evidences
          WHERE response_id IN (
            SELECT ar1.id FROM audit_responses ar1
            WHERE ar1.audit_item_id = ANY($1)
            AND EXISTS (
              SELECT 1 FROM audit_responses ar2
              WHERE ar2.audit_id = ar1.audit_id
              AND ar2.audit_item_id = $2
            )
          )
        `, [duplicateIds, keepId]);

        // Delete duplicate audit_responses that would cause constraint violations
        await db.query(`
          DELETE FROM audit_responses ar1
          WHERE ar1.audit_item_id = ANY($1)
          AND EXISTS (
            SELECT 1 FROM audit_responses ar2
            WHERE ar2.audit_id = ar1.audit_id
            AND ar2.audit_item_id = $2
          )
        `, [duplicateIds, keepId]);

        // Now update any remaining responses to point to the kept item
        await db.query(`
          UPDATE audit_responses
          SET audit_item_id = $1
          WHERE audit_item_id = ANY($2)
        `, [keepId, duplicateIds]);

        // Delete duplicate items
        await db.query(`
          DELETE FROM audit_items WHERE id = ANY($1)
        `, [duplicateIds]);

        logger.info(`Cleaned up ${duplicateIds.length} duplicate items for section ${row.section_id}, sr_no ${row.sr_no}`);
      }
    }

    // 3. Add unique constraint to audit_items if not exists
    logger.info('Adding unique constraint to audit_items...');
    try {
      await db.query(`
        ALTER TABLE audit_items
        ADD CONSTRAINT audit_items_section_srno_unique
        UNIQUE (section_id, sr_no)
      `);
      logger.info('Added unique constraint to audit_items');
    } catch (error: any) {
      if (error.code === '42710') { // constraint already exists
        logger.info('Unique constraint already exists on audit_items');
      } else {
        throw error;
      }
    }

    // 4. Add unique constraint to audit_sections if not exists
    logger.info('Adding unique constraint to audit_sections...');
    try {
      await db.query(`
        ALTER TABLE audit_sections
        ADD CONSTRAINT audit_sections_category_code_unique
        UNIQUE (category_id, code)
      `);
      logger.info('Added unique constraint to audit_sections');
    } catch (error: any) {
      if (error.code === '42710') { // constraint already exists
        logger.info('Unique constraint already exists on audit_sections');
      } else {
        throw error;
      }
    }

    // Report final counts
    const sectionCount = await db.query('SELECT COUNT(*) FROM audit_sections');
    const itemCount = await db.query('SELECT COUNT(*) FROM audit_items');

    logger.info(`Cleanup complete. Sections: ${sectionCount.rows[0].count}, Items: ${itemCount.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupDuplicates();
