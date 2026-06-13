import { db } from './connection';
import { logger } from '../utils/logger';

async function cleanupDuplicates() {
  try {
    logger.info('Starting duplicate cleanup...');

    // Run the whole repair in one transaction so a mid-way failure cannot leave
    // half-merged data behind.
    await db.transaction(async (client) => {
      // 1. Find and remove duplicate audit_sections
      // Keep the one with lowest ID, update items to point to it, then delete duplicates
      logger.info('Cleaning up duplicate audit_sections...');

      const duplicateSections = await client.query(`
        SELECT category_id, code, MIN(id) as keep_id, array_agg(id) as all_ids
        FROM audit_sections
        GROUP BY category_id, code
        HAVING COUNT(*) > 1
      `);

      for (const row of duplicateSections.rows) {
        const keepId = row.keep_id;
        const duplicateIds = row.all_ids.filter((id: number) => id !== keepId);

        if (duplicateIds.length > 0) {
          await client.query(`
            UPDATE audit_items SET section_id = $1 WHERE section_id = ANY($2)
          `, [keepId, duplicateIds]);

          await client.query(`
            DELETE FROM audit_sections WHERE id = ANY($1)
          `, [duplicateIds]);

          logger.info(`Cleaned up ${duplicateIds.length} duplicate sections for category ${row.category_id}, code ${row.code}`);
        }
      }

      // 2. Remove duplicate audit_items (same section_id and sr_no)
      logger.info('Cleaning up duplicate audit_items...');

      const duplicateItems = await client.query(`
        SELECT section_id, sr_no, MIN(id) as keep_id, array_agg(id) as all_ids
        FROM audit_items
        GROUP BY section_id, sr_no
        HAVING COUNT(*) > 1
      `);

      for (const row of duplicateItems.rows) {
        const keepId = row.keep_id;
        const duplicateIds = row.all_ids.filter((id: number) => id !== keepId);

        if (duplicateIds.length > 0) {
          // For each (audit) that has both a duplicate-item response and a
          // keep-item response, decide which response to keep by most-recent
          // update so we never silently drop the newer observation.
          const collidingPairs = await client.query(`
            SELECT ar1.id as dup_id, ar2.id as keep_id
            FROM audit_responses ar1
            JOIN audit_responses ar2
              ON ar2.audit_id = ar1.audit_id AND ar2.audit_item_id = $2
            WHERE ar1.audit_item_id = ANY($1)
          `, [duplicateIds, keepId]);

          for (const pair of collidingPairs.rows) {
            // Re-point evidences and CAPA from the duplicate response onto the
            // survivor (the keep-item response) instead of deleting them.
            await client.query(
              `UPDATE audit_evidences SET response_id = $1 WHERE response_id = $2`,
              [pair.keep_id, pair.dup_id]
            );
            await client.query(
              `UPDATE capa SET response_id = $1 WHERE response_id = $2`,
              [pair.keep_id, pair.dup_id]
            );
            // Keep the more recently updated observation on the survivor.
            await client.query(`
              UPDATE audit_responses keep
              SET status = dup.status,
                  observation = dup.observation,
                  risk_rating = dup.risk_rating,
                  capa_required = dup.capa_required,
                  remarks = dup.remarks,
                  updated_at = dup.updated_at
              FROM audit_responses dup
              WHERE keep.id = $1 AND dup.id = $2
                AND dup.updated_at > keep.updated_at
            `, [pair.keep_id, pair.dup_id]);
            // Now the duplicate response is fully merged; remove it.
            await client.query(`DELETE FROM audit_responses WHERE id = $1`, [pair.dup_id]);
          }

          // Any remaining (non-colliding) responses just re-point to the kept item.
          await client.query(`
            UPDATE audit_responses SET audit_item_id = $1 WHERE audit_item_id = ANY($2)
          `, [keepId, duplicateIds]);

          await client.query(`
            DELETE FROM audit_items WHERE id = ANY($1)
          `, [duplicateIds]);

          logger.info(`Cleaned up ${duplicateIds.length} duplicate items for section ${row.section_id}, sr_no ${row.sr_no}`);
        }
      }

      // 3. Add unique constraint to audit_items if not exists
      logger.info('Adding unique constraint to audit_items...');
      try {
        await client.query(`
          ALTER TABLE audit_items
          ADD CONSTRAINT audit_items_section_srno_unique
          UNIQUE (section_id, sr_no)
        `);
        logger.info('Added unique constraint to audit_items');
      } catch (error: any) {
        if (error.code === '42710' || error.code === '42P07') { // constraint/relation already exists
          logger.info('Unique constraint already exists on audit_items');
        } else {
          throw error;
        }
      }

      // 4. Add unique constraint to audit_sections if not exists
      logger.info('Adding unique constraint to audit_sections...');
      try {
        await client.query(`
          ALTER TABLE audit_sections
          ADD CONSTRAINT audit_sections_category_code_unique
          UNIQUE (category_id, code)
        `);
        logger.info('Added unique constraint to audit_sections');
      } catch (error: any) {
        if (error.code === '42710' || error.code === '42P07') {
          logger.info('Unique constraint already exists on audit_sections');
        } else {
          throw error;
        }
      }
    });

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
