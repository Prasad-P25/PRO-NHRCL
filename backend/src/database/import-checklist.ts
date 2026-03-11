import * as XLSX from 'xlsx';
import { db } from './connection';
import { logger } from '../utils/logger';

interface AuditItem {
  srNo: number;
  auditPoint: string;
  standardReference: string;
  evidenceRequired: string;
  priority: string;
}

interface Section {
  code: string;
  name: string;
  items: AuditItem[];
}

interface Category {
  code: string;
  name: string;
  fullTitle: string;
  sections: Section[];
}

// Map sheet names to category codes
const sheetMapping: Record<string, { code: string; name: string; fullTitle: string }> = {
  '1. STATUTORY COMPLIANCE': { code: '01', name: 'Statutory Compliance', fullTitle: 'STATUTORY & LEGAL COMPLIANCE AUDIT' },
  '2. SHE MANAGEMENT SYSTEM': { code: '02', name: 'SHE Management System', fullTitle: 'SHE MANAGEMENT SYSTEM AUDIT (ISO 45001:2018)' },
  '3. HIRA & RISK CONTROL': { code: '03', name: 'HIRA & Risk Control', fullTitle: 'HAZARD IDENTIFICATION & RISK ASSESSMENT' },
  '4. WORK PERMITS & LOTO': { code: '04', name: 'Work Permits & LOTO', fullTitle: 'PERMIT TO WORK & LOCKOUT-TAGOUT' },
  '5. SCAFFOLDING & HEIGHT': { code: '05', name: 'Scaffolding & Work at Height', fullTitle: 'SCAFFOLDING & WORK AT HEIGHT SAFETY' },
  '6. EXCAVATION & EARTHWORK': { code: '06', name: 'Excavation & Earthwork', fullTitle: 'EXCAVATION & EARTHWORK SAFETY' },
  '7. TUNNELING SAFETY': { code: '07', name: 'Tunneling Safety', fullTitle: 'TUNNEL & UNDERGROUND WORKS SAFETY' },
  '8. LIFTING & CRANES': { code: '08', name: 'Lifting & Cranes', fullTitle: 'LIFTING OPERATIONS & CRANE SAFETY' },
  '9. ELECTRICAL SAFETY': { code: '09', name: 'Electrical Safety', fullTitle: 'ELECTRICAL SAFETY' },
  '10. FIRE & EMERGENCY': { code: '10', name: 'Fire & Emergency', fullTitle: 'FIRE PREVENTION & EMERGENCY PREPAREDNESS' },
  '11. PPE & WELFARE': { code: '11', name: 'PPE & Welfare', fullTitle: 'PPE MANAGEMENT & WORKER WELFARE' },
  '12. TRAINING & COMPETENCY': { code: '12', name: 'Training & Competency', fullTitle: 'TRAINING & COMPETENCY MANAGEMENT' },
  '13. WORKING NEAR IR TRACK': { code: '13', name: 'Working Near IR Track', fullTitle: 'WORKING NEAR INDIAN RAILWAYS TRACK' },
  '14. FORMWORK & TEMP STRUCT': { code: '14', name: 'Formwork & Temp Structures', fullTitle: 'FORMWORK & TEMPORARY STRUCTURES' },
  '15. BRIDGE & VIADUCT WORKS': { code: '15', name: 'Bridge & Viaduct Works', fullTitle: 'BRIDGE & VIADUCT CONSTRUCTION SAFETY' },
  '16. PLANT & MACHINERY': { code: '16', name: 'Plant & Machinery', fullTitle: 'PLANT & MACHINERY SAFETY' },
  '17. MATERIAL HANDLING': { code: '17', name: 'Material Handling', fullTitle: 'MATERIAL STORAGE & HANDLING' },
  '18. INCIDENT MANAGEMENT': { code: '18', name: 'Incident Management', fullTitle: 'INCIDENT INVESTIGATION & REPORTING' },
};

function parseSheet(ws: XLSX.WorkSheet): Section[] {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const firstCell = row[0];
    const secondCell = row[1];

    // Check if this is a section header (e.g., "A. BOCW ACT 1996...")
    // Section headers have null in first column and "X. TITLE" in second column
    if ((firstCell === null || firstCell === undefined || firstCell === '') &&
        secondCell && typeof secondCell === 'string' && /^[A-Z]\.\s/.test(secondCell)) {
      const match = secondCell.match(/^([A-Z])\.\s*(.+)$/);
      if (match) {
        currentSection = {
          code: match[1],
          name: match[2].trim(),
          items: [],
        };
        sections.push(currentSection);
      }
    }
    // Check if this is an audit item (first cell is a number)
    else if (typeof firstCell === 'number' && currentSection) {
      const item: AuditItem = {
        srNo: firstCell,
        auditPoint: String(row[1] || '').trim(),
        standardReference: String(row[2] || '').trim(),
        evidenceRequired: String(row[5] || '').trim(),
        priority: String(row[6] || 'P1').trim(),
      };
      if (item.auditPoint) {
        currentSection.items.push(item);
      }
    }
    // Also handle case where first cell might be string number "1", "2", etc.
    else if (typeof firstCell === 'string' && /^\d+$/.test(firstCell) && currentSection) {
      const item: AuditItem = {
        srNo: parseInt(firstCell),
        auditPoint: String(row[1] || '').trim(),
        standardReference: String(row[2] || '').trim(),
        evidenceRequired: String(row[5] || '').trim(),
        priority: String(row[6] || 'P1').trim(),
      };
      if (item.auditPoint) {
        currentSection.items.push(item);
      }
    }
  }

  return sections;
}

async function importChecklist() {
  try {
    const filePath = 'c:/Users/prasa/Downloads/Audit_Checklist.xlsx';
    logger.info('Reading Excel file: ' + filePath);

    const wb = XLSX.readFile(filePath);
    const categories: Category[] = [];

    // Process each sheet
    for (const sheetName of wb.SheetNames) {
      const mapping = sheetMapping[sheetName];
      if (!mapping) {
        logger.info('Skipping sheet: ' + sheetName);
        continue;
      }

      logger.info('Processing sheet: ' + sheetName);
      const ws = wb.Sheets[sheetName];
      const sections = parseSheet(ws);

      const category: Category = {
        code: mapping.code,
        name: mapping.name,
        fullTitle: mapping.fullTitle,
        sections,
      };
      categories.push(category);

      logger.info(`  Found ${sections.length} sections with ${sections.reduce((sum, s) => sum + s.items.length, 0)} items`);
    }

    // Now insert into database
    logger.info('Inserting data into database...');

    for (const category of categories) {
      // Check if category exists
      let catResult = await db.query(
        `SELECT id FROM audit_categories WHERE code = $1`,
        [category.code]
      );

      let categoryId: number;
      if (catResult.rows.length > 0) {
        // Update existing
        categoryId = catResult.rows[0].id;
        await db.query(
          `UPDATE audit_categories SET name = $1, full_title = $2 WHERE id = $3`,
          [category.name, category.fullTitle, categoryId]
        );
      } else {
        // Insert new
        catResult = await db.query(
          `INSERT INTO audit_categories (code, name, full_title, type, display_order, is_active)
           VALUES ($1, $2, $3, 'Compliance', $4, true)
           RETURNING id`,
          [category.code, category.name, category.fullTitle, parseInt(category.code)]
        );
        categoryId = catResult.rows[0].id;
      }

      // Delete existing sections and items for this category (clean import)
      await db.query(
        `DELETE FROM audit_items WHERE section_id IN (SELECT id FROM audit_sections WHERE category_id = $1)`,
        [categoryId]
      );
      await db.query(`DELETE FROM audit_sections WHERE category_id = $1`, [categoryId]);

      // Insert sections and items
      for (let secIndex = 0; secIndex < category.sections.length; secIndex++) {
        const section = category.sections[secIndex];

        const secResult = await db.query(
          `INSERT INTO audit_sections (category_id, code, name, display_order)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [categoryId, section.code, section.name, secIndex + 1]
        );
        const sectionId = secResult.rows[0].id;

        // Insert items
        for (const item of section.items) {
          await db.query(
            `INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true)`,
            [sectionId, item.srNo, item.auditPoint, item.standardReference, item.evidenceRequired, item.priority || 'P1']
          );
        }
      }

      logger.info(`  Imported category ${category.code}: ${category.name}`);
    }

    // Count total items
    const countResult = await db.query(`SELECT COUNT(*) as count FROM audit_items`);
    logger.info(`Total audit items in database: ${countResult.rows[0].count}`);

    logger.info('Import completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Import failed:', error);
    process.exit(1);
  }
}

importChecklist();
