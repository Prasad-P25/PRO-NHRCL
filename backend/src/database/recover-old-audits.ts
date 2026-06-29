/**
 * recover-old-audits.ts
 * One-off recovery: bring the two pre-reload audits (done on the OLD checklist)
 * back into the live DB, preserving every answer + evidence.
 *
 *  - Each old response whose audit_point text matches a point in the NEW
 *    checklist is mapped onto that real checklist item.
 *  - Every other old response is recreated as an "Added" (custom) checkpoint
 *    on the matching category/section, carrying its original text + answer.
 *  - Evidence rows are re-linked to the new responses (files on disk unchanged).
 *
 * Source DB: mahsr_safety_archive   Target DB: mahsr_safety
 * Run:  npx ts-node src/database/recover-old-audits.ts
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const base = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
};
const prod = new Pool({ ...base, database: 'mahsr_safety' });
const arch = new Pool({ ...base, database: 'mahsr_safety_archive' });

const norm = (s: any) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const AUDITS = ['AUD-C3-S1-2026-001', 'AUD-C3-S2-2026-001'];

async function main() {
  // ---- Build lookups from the NEW (prod) checklist ----
  const items = (await prod.query(
    `SELECT ai.id, ai.audit_point, ai.section_id, s.code sec_code, s.category_id, c.code cat_code
     FROM audit_items ai
     JOIN audit_sections s ON ai.section_id = s.id
     JOIN audit_categories c ON s.category_id = c.id
     WHERE ai.is_active AND ai.is_custom = false
     ORDER BY c.display_order, s.display_order, ai.sr_no`
  )).rows;

  const itemByText = new Map<string, { itemId: number; categoryId: number }>();
  const sectionByCatSec = new Map<string, { sectionId: number; categoryId: number }>();
  const firstSectionByCat = new Map<string, { sectionId: number; categoryId: number }>();
  for (const r of items) {
    const t = norm(r.audit_point);
    if (!itemByText.has(t)) itemByText.set(t, { itemId: r.id, categoryId: r.category_id });
    const key = `${r.cat_code}|${r.sec_code}`;
    if (!sectionByCatSec.has(key)) sectionByCatSec.set(key, { sectionId: r.section_id, categoryId: r.category_id });
    if (!firstSectionByCat.has(r.cat_code)) firstSectionByCat.set(r.cat_code, { sectionId: r.section_id, categoryId: r.category_id });
  }
  const fallback = items.length ? { sectionId: items[0].section_id, categoryId: items[0].category_id } : null;

  for (const num of AUDITS) {
    const a = (await arch.query(`SELECT * FROM audits WHERE audit_number = $1`, [num])).rows[0];
    if (!a) { console.log(`skip (not in archive): ${num}`); continue; }
    if ((await prod.query(`SELECT id FROM audits WHERE audit_number = $1`, [num])).rows[0]) {
      console.log(`skip (already exists in prod): ${num}`); continue;
    }

    const resp = (await arch.query(
      `SELECT r.id rid, r.status, r.observation, r.risk_rating, r.capa_required, r.remarks, r.updated_by,
              ai.audit_point, s.code sec_code, c.code cat_code
       FROM audit_responses r
       JOIN audit_items ai ON r.audit_item_id = ai.id
       JOIN audit_sections s ON ai.section_id = s.id
       JOIN audit_categories c ON s.category_id = c.id
       WHERE r.audit_id = $1
       ORDER BY c.display_order, s.display_order, ai.sr_no`,
      [a.id]
    )).rows;

    const client = await prod.connect();
    try {
      await client.query('BEGIN');
      const newAuditId = (await client.query(
        `INSERT INTO audits (audit_number, package_id, audit_type, auditor_id, reviewer_id,
                             contractor_rep, scheduled_date, audit_date, status, total_items)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [a.audit_number, a.package_id, a.audit_type, a.auditor_id, a.reviewer_id,
         a.contractor_rep, a.scheduled_date, a.audit_date, a.status, resp.length]
      )).rows[0].id;

      const usedItemIds = new Set<number>();
      const touchedCats = new Set<number>();
      const srCounter = new Map<number, number>();
      let mapped = 0, added = 0, evid = 0;

      for (const r of resp) {
        let targetItemId: number, targetCat: number;
        const t = norm(r.audit_point);
        const m = itemByText.get(t);

        if (m && !usedItemIds.has(m.itemId)) {
          targetItemId = m.itemId; targetCat = m.categoryId; usedItemIds.add(m.itemId); mapped++;
        } else {
          const sec = sectionByCatSec.get(`${r.cat_code}|${r.sec_code}`)
            || firstSectionByCat.get(r.cat_code) || fallback!;
          const existing = srCounter.get(sec.sectionId);
          const srNo: number = existing !== undefined ? existing : Number((await client.query(
            `SELECT COALESCE(MAX(sr_no),0)+1 n FROM audit_items
             WHERE section_id=$1 AND (is_custom=false OR created_in_audit_id=$2)`,
            [sec.sectionId, newAuditId]
          )).rows[0].n);
          const ci = (await client.query(
            `INSERT INTO audit_items (section_id, sr_no, audit_point, priority, is_active, is_custom, created_in_audit_id, created_by)
             VALUES ($1,$2,$3,'P2',true,true,$4,$5) RETURNING id`,
            [sec.sectionId, srNo, r.audit_point, newAuditId, a.auditor_id]
          )).rows[0];
          srCounter.set(sec.sectionId, srNo + 1);
          targetItemId = ci.id; targetCat = sec.categoryId; added++;
        }
        touchedCats.add(targetCat);

        const newRespId = (await client.query(
          `INSERT INTO audit_responses (audit_id, audit_item_id, status, observation, risk_rating, capa_required, remarks, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [newAuditId, targetItemId, r.status, r.observation, r.risk_rating, r.capa_required, r.remarks, r.updated_by]
        )).rows[0].id;

        const evs = (await arch.query(
          `SELECT file_name, file_path, file_type, file_size, uploaded_by, uploaded_at FROM audit_evidences WHERE response_id=$1`,
          [r.rid]
        )).rows;
        for (const e of evs) {
          await client.query(
            `INSERT INTO audit_evidences (response_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [newRespId, e.file_name, e.file_path, e.file_type, e.file_size, e.uploaded_by, e.uploaded_at]
          );
          evid++;
        }
      }

      for (const cid of touchedCats) {
        await client.query(
          `INSERT INTO audit_category_selection (audit_id, category_id) VALUES ($1,$2)
           ON CONFLICT (audit_id, category_id) DO NOTHING`,
          [newAuditId, cid]
        );
      }

      const counts = (await client.query(
        `SELECT status, count(*) n FROM audit_responses WHERE audit_id=$1 GROUP BY status`, [newAuditId]
      )).rows;
      let C = 0, NC = 0, NA = 0;
      for (const c of counts) { if (c.status === 'C') C = +c.n; else if (c.status === 'NC') NC = +c.n; else if (c.status === 'NA') NA = +c.n; }
      const comp = (C + NC) > 0 ? Math.round((C / (C + NC)) * 1000) / 10 : null;
      await client.query(
        `UPDATE audits SET compliant_count=$1, non_compliant_count=$2, na_count=$3, compliance_percentage=$4 WHERE id=$5`,
        [C, NC, NA, comp, newAuditId]
      );

      await client.query('COMMIT');
      console.log(`${num}: OK -> audit ${newAuditId} | responses=${resp.length} mapped=${mapped} added=${added} evidence=${evid} categories=${touchedCats.size} compliance=${comp}%`);
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error(`${num}: FAILED (rolled back): ${e.message}`);
    } finally {
      client.release();
    }
  }

  await prod.end();
  await arch.end();
}

main().catch((e) => { console.error('Recovery failed:', e); process.exit(1); });
