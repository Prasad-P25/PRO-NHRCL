/**
 * reload-checklist.ts
 * Clean reload of the audit checklist from the corrected MAHSR V5 workbook.
 * - Imports ALL 28 category sheets (skips INDEX).
 * - Handles the 3 non-standard sheets (19 Leading, 20 Lagging, 21 Maturity).
 * - Wipes old placeholder checklist + dependent audit data in one transaction
 *   (a pre-change pg_dump backup was taken separately).
 *
 * Run:  npx ts-node src/database/reload-checklist.ts
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { db } from './connection';
import { logger } from '../utils/logger';

const EXCEL_CANDIDATES = [
  'C:/PROJECTS/PRO-NHRCL/backend/MAHSR_V5.xlsx',
  '//PLLP_NAS/Protecther/BD/tenders/2025-26/NHSRCL/checklist/MAHSR V5.xlsx',
];

// Curated short names per category code; full_title falls back to the sheet's title cell.
const NAMES: Record<string, string> = {
  '01': 'Statutory Compliance', '02': 'SHE Management System', '03': 'HIRA & Risk Control',
  '04': 'Work Permits & LOTO', '05': 'Scaffolding & Work at Height', '06': 'Excavation & Earthwork',
  '07': 'Tunneling Safety', '08': 'Lifting & Cranes', '09': 'Electrical Safety',
  '10': 'Fire & Emergency', '11': 'PPE & Welfare', '12': 'Training & Competency',
  '13': 'Working Near IR Track', '14': 'Formwork & Temp Structures', '15': 'Bridge & Viaduct Works',
  '16': 'Plant & Machinery', '17': 'Material Handling', '18': 'Incident Management',
  '19': 'Leading Indicators', '20': 'Lagging Indicators', '21': 'Safety Maturity Survey',
  '22': 'PMC Oversight Review', '23': 'Rigging & Piling', '24': 'Casting',
  '25': 'PT Strand', '26': 'RMC Plant', '27': 'Reinforcement Cutting & Bending',
  '28': 'Shuttering & Deshuttering',
};

// Column index overrides for sheets that don't use the standard layout.
// Standard: Sr=0, Point=1, Ref=2, Status=3, Obs=4, Evidence=5, Priority=6, Remarks=7
type ColMap = { point: number; ref: number; evidence: number | null; priority: number | null };
const STANDARD: ColMap = { point: 1, ref: 2, evidence: 5, priority: 6 };
const OVERRIDES: Record<string, ColMap> = {
  '19': { point: 1, ref: 2, evidence: null, priority: null }, // Leading: Indicator | Definition | Target | Actual ...
  '20': { point: 1, ref: 2, evidence: null, priority: null }, // Lagging: Indicator | Formula | Current | YTD ...
  '21': { point: 2, ref: 1, evidence: 4, priority: null },    // Maturity: Dimension | Question | Score | Evidence ...
};

const VALID_PRIORITY = new Set(['P1', 'P2', 'P3']);
function cleanPriority(raw: any): string {
  const p = String(raw ?? '').trim().toUpperCase();
  return VALID_PRIORITY.has(p) ? p : 'P1';
}
function txt(v: any): string { return String(v ?? '').replace(/\s+/g, ' ').trim(); }

interface Item { srNo: number; auditPoint: string; ref: string; evidence: string; priority: string; }
interface Section { code: string; name: string; items: Item[]; }

function parseSheet(ws: XLSX.WorkSheet, cols: ColMap): Section[] {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  const sections: Section[] = [];
  let cur: Section | null = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const a = row[0];
    const b = row[1];

    // Section header: empty Sr column + "X. TITLE" in second column
    if ((a === null || a === undefined || a === '') &&
        typeof b === 'string' && /^[A-Z]\.\s/.test(b)) {
      const m = b.match(/^([A-Z])\.\s*(.+)$/);
      if (m) { cur = { code: m[1], name: txt(m[2]), items: [] }; sections.push(cur); }
      continue;
    }

    // Item row: Sr column is a number (or numeric string)
    const isNum = typeof a === 'number' || (typeof a === 'string' && /^\d+$/.test(a.trim()));
    if (isNum) {
      if (!cur) { cur = { code: 'A', name: 'General', items: [] }; sections.push(cur); }
      const point = txt(row[cols.point]);
      if (!point) continue;
      cur.items.push({
        srNo: parseInt(String(a), 10),
        auditPoint: point,
        ref: txt(row[cols.ref]),
        evidence: cols.evidence === null ? '' : txt(row[cols.evidence]),
        priority: cols.priority === null ? 'P1' : cleanPriority(row[cols.priority]),
      });
    }
  }
  return sections;
}

async function main() {
  const filePath = EXCEL_CANDIDATES.find(p => fs.existsSync(p));
  if (!filePath) { logger.error('MAHSR V5 workbook not found in any known location'); process.exit(1); }
  logger.info('Reading workbook: ' + filePath);
  const wb = XLSX.readFile(filePath);

  // Build category list from sheet names (derive code from leading number; skip INDEX).
  const cats: { code: string; name: string; fullTitle: string; sections: Section[] }[] = [];
  for (const sheetName of wb.SheetNames) {
    const m = sheetName.match(/^\s*(\d+)\.\s*(.+)$/);
    if (!m) { logger.info('Skipping non-category sheet: ' + sheetName); continue; }
    const code = m[1].padStart(2, '0');
    const cols = OVERRIDES[code] || STANDARD;
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    const titleCell = txt((data[0] || [])[0]);
    const sections = parseSheet(ws, cols);
    const count = sections.reduce((s, x) => s + x.items.length, 0);
    cats.push({
      code,
      name: NAMES[code] || txt(m[2]),
      fullTitle: titleCell || NAMES[code] || txt(m[2]),
      sections,
    });
    logger.info(`  ${code} ${NAMES[code] || txt(m[2])}: ${sections.length} sections, ${count} items`);
  }

  const grand = cats.reduce((s, c) => s + c.sections.reduce((y, x) => y + x.items.length, 0), 0);
  logger.info(`PARSED: ${cats.length} categories, ${grand} items total`);
  if (process.env.DRY === '1') { logger.info('DRY run - no DB changes'); process.exit(0); }

  await db.transaction(async (client) => {
    logger.info('Wiping old checklist + dependent audit data (CASCADE)...');
    await client.query('TRUNCATE TABLE audit_categories, audits RESTART IDENTITY CASCADE');

    for (const cat of cats) {
      const cr = await client.query(
        `INSERT INTO audit_categories (code, name, full_title, type, display_order, is_active)
         VALUES ($1,$2,$3,'Compliance',$4,true) RETURNING id`,
        [cat.code, cat.name, cat.fullTitle, parseInt(cat.code, 10)]
      );
      const categoryId = cr.rows[0].id;

      for (let si = 0; si < cat.sections.length; si++) {
        const sec = cat.sections[si];
        const sr = await client.query(
          `INSERT INTO audit_sections (category_id, code, name, display_order)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [categoryId, sec.code, sec.name.slice(0, 255), si + 1]
        );
        const sectionId = sr.rows[0].id;

        for (const it of sec.items) {
          await client.query(
            `INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,true)`,
            [sectionId, it.srNo, it.auditPoint, it.ref, it.evidence, it.priority]
          );
        }
      }
    }
  });

  const cnt = await db.query(`
    SELECT (SELECT COUNT(*) FROM audit_categories) c,
           (SELECT COUNT(*) FROM audit_sections) s,
           (SELECT COUNT(*) FROM audit_items) i`);
  logger.info(`DONE. categories=${cnt.rows[0].c} sections=${cnt.rows[0].s} items=${cnt.rows[0].i}`);
  process.exit(0);
}

main().catch((e) => { logger.error('Reload failed:', e); process.exit(1); });
