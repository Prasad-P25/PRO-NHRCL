import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createNotification, getPackageManagers, getUsersByRole } from './notification.controller';
import { logger } from '../utils/logger';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  VerticalAlign,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ShadingType,
  TableBorders,
  convertInchesToTwip,
  convertMillimetersToTwip,
  PageOrientation,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

// Logo paths (place logos in backend/src/assets/logos/)
const ASSETS_PATH = path.join(__dirname, '..', 'assets', 'logos');
const PROTECTHER_LOGO = path.join(ASSETS_PATH, 'protecther-logo.png');

// ---------------------------------------------------------------------------
// Sequential number generation (shared with capa.controller.ts).
//
// Numbers are computed from the MAX existing sequence for the prefix instead
// of COUNT(*), so deletions never cause duplicates. Concurrent inserts are
// handled by retrying the whole operation (including number generation) when
// the unique constraint on the number column is violated (PostgreSQL error
// code 23505). When used with a transaction the retry must wrap the whole
// transaction (an aborted Postgres transaction cannot be resumed).
// ---------------------------------------------------------------------------

const UNIQUE_VIOLATION = '23505';
const MAX_NUMBER_ATTEMPTS = 3;

// Minimal interface satisfied by both the db wrapper and a pg PoolClient,
// so generators can run inside or outside a transaction.
export interface Queryable {
  query: (text: string, params?: any[]) => Promise<any>;
}

export const isUniqueViolation = (error: any): boolean =>
  !!error && error.code === UNIQUE_VIOLATION;

export const withUniqueRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_NUMBER_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
};

/**
 * Next audit number: AUD-{PACKAGE_CODE}-{YEAR}-{NNN}.
 * Sequence is per package per year, parsed from the numeric suffix
 * (the digits after the last hyphen) of existing audit numbers.
 */
export const generateAuditNumber = async (client: Queryable, packageCode: string): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `AUD-${packageCode}-${year}-`;
  const result = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(audit_number FROM '[0-9]+$') AS INTEGER)), 0) AS max_seq
     FROM audits
     WHERE audit_number LIKE $1`,
    [`${prefix}%`]
  );
  const next = parseInt(result.rows[0].max_seq, 10) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
};

/**
 * Next CAPA number: CAPA-{YEAR}-{NNNN} (unified 4-digit format).
 * The numeric suffix is parsed after the last hyphen, so legacy 3-digit
 * numbers (CAPA-2025-007) and 4-digit numbers (CAPA-2025-0007) both count
 * toward the max. `offset` lets callers reserve several consecutive numbers
 * when batch-inserting within a single transaction.
 */
export const generateCapaNumber = async (client: Queryable, offset = 0): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `CAPA-${year}-`;
  const result = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(capa_number FROM '[0-9]+$') AS INTEGER)), 0) AS max_seq
     FROM capa
     WHERE capa_number LIKE $1`,
    [`${prefix}%`]
  );
  const next = parseInt(result.rows[0].max_seq, 10) + 1 + offset;
  return `${prefix}${String(next).padStart(4, '0')}`;
};

// ---------------------------------------------------------------------------
// Project access guards (IDOR protection)
// ---------------------------------------------------------------------------

/**
 * Verify the audit exists and belongs to the caller's project.
 * Super Admin may access audits in any project.
 * Throws 404 if the audit does not exist, 403 if it belongs to another project.
 */
const assertAuditAccess = async (auditId: string | number, req: AuthRequest) => {
  const result = await db.query(
    `SELECT a.id, a.status, a.locked_at, p.project_id
     FROM audits a
     JOIN packages p ON a.package_id = p.id
     WHERE a.id = $1`,
    [auditId]
  );
  if (result.rows.length === 0) {
    throw new AppError('Audit not found', 404);
  }
  if (req.user!.roleName !== 'Super Admin' && result.rows[0].project_id !== req.projectId) {
    throw new AppError('Access denied to this audit', 403);
  }
  return result.rows[0];
};

/**
 * Verify the audit response exists and its audit belongs to the caller's project.
 * Throws 404 if the response does not exist, 403 if it belongs to another project.
 */
const assertResponseAccess = async (responseId: string | number, req: AuthRequest) => {
  const result = await db.query(
    `SELECT ar.id, a.id as audit_id, a.status, a.locked_at, p.project_id
     FROM audit_responses ar
     JOIN audits a ON ar.audit_id = a.id
     JOIN packages p ON a.package_id = p.id
     WHERE ar.id = $1`,
    [responseId]
  );
  if (result.rows.length === 0) {
    throw new AppError('Response not found', 404);
  }
  if (req.user!.roleName !== 'Super Admin' && result.rows[0].project_id !== req.projectId) {
    throw new AppError('Access denied to this audit', 403);
  }
  return result.rows[0];
};

// Map a stored mime type / file path to a docx ImageRun type
const getImageType = (fileType?: string, filePath?: string): 'png' | 'jpg' | 'gif' | 'bmp' => {
  const source = `${fileType || ''} ${filePath || ''}`.toLowerCase();
  if (source.includes('jpeg') || source.includes('jpg')) return 'jpg';
  if (source.includes('gif')) return 'gif';
  if (source.includes('bmp')) return 'bmp';
  return 'png';
};

export class AuditController {
  getAllAudits = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, status, auditorId } = req.query;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
      const offset = (page - 1) * pageSize;
      const projectId = req.projectId;

      let query = `
        SELECT a.*, p.code as package_code, p.name as package_name,
               u.name as auditor_name, u.email as auditor_email
        FROM audits a
        JOIN packages p ON a.package_id = p.id
        LEFT JOIN users u ON a.auditor_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Project filter
      if (projectId) {
        query += ` AND p.project_id = $${paramIndex++}`;
        params.push(projectId);
      }

      // Visibility for non-admin roles: their assigned package PLUS any audit
      // they personally conducted. Without the auditor_id branch, an auditor
      // who creates an audit for a package other than their assigned one (the
      // New Audit wizard allows this) could never see it in the list again.
      if (req.user!.roleName !== 'Super Admin' && req.user!.roleName !== 'PMC Head') {
        if (req.user!.packageId) {
          query += ` AND (a.package_id = $${paramIndex} OR a.auditor_id = $${paramIndex + 1})`;
          params.push(req.user!.packageId, req.user!.id);
          paramIndex += 2;
        } else {
          query += ` AND a.auditor_id = $${paramIndex++}`;
          params.push(req.user!.id);
        }
      }

      if (packageId) {
        query += ` AND a.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      if (status) {
        query += ` AND a.status = $${paramIndex++}`;
        params.push(status);
      }

      if (auditorId) {
        query += ` AND a.auditor_id = $${paramIndex++}`;
        params.push(auditorId);
      }

      // Get total count - use parameterized query for security and reliability
      let countQuery = `
        SELECT COUNT(*) as count
        FROM audits a
        JOIN packages p ON a.package_id = p.id
        LEFT JOIN users u ON a.auditor_id = u.id
        WHERE 1=1
      `;
      const countParams: any[] = [];
      let countParamIndex = 1;

      if (projectId) {
        countQuery += ` AND p.project_id = $${countParamIndex++}`;
        countParams.push(projectId);
      }
      if (req.user!.roleName !== 'Super Admin' && req.user!.roleName !== 'PMC Head') {
        if (req.user!.packageId) {
          countQuery += ` AND (a.package_id = $${countParamIndex} OR a.auditor_id = $${countParamIndex + 1})`;
          countParams.push(req.user!.packageId, req.user!.id);
          countParamIndex += 2;
        } else {
          countQuery += ` AND a.auditor_id = $${countParamIndex++}`;
          countParams.push(req.user!.id);
        }
      }
      if (packageId) {
        countQuery += ` AND a.package_id = $${countParamIndex++}`;
        countParams.push(packageId);
      }
      if (status) {
        countQuery += ` AND a.status = $${countParamIndex++}`;
        countParams.push(status);
      }
      if (auditorId) {
        countQuery += ` AND a.auditor_id = $${countParamIndex++}`;
        countParams.push(auditorId);
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.count || '0');

      // Add pagination
      query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(pageSize, offset);

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((audit) => ({
          id: audit.id,
          auditNumber: audit.audit_number,
          packageId: audit.package_id,
          package: {
            id: audit.package_id,
            code: audit.package_code,
            name: audit.package_name,
          },
          auditType: audit.audit_type,
          auditorId: audit.auditor_id,
          auditor: audit.auditor_id
            ? {
                id: audit.auditor_id,
                name: audit.auditor_name,
                email: audit.auditor_email,
              }
            : null,
          contractorRep: audit.contractor_rep,
          scheduledDate: audit.scheduled_date,
          auditDate: audit.audit_date,
          status: audit.status,
          totalItems: audit.total_items,
          compliantCount: audit.compliant_count,
          nonCompliantCount: audit.non_compliant_count,
          naCount: audit.na_count,
          compliancePercentage: audit.compliance_percentage,
          createdAt: audit.created_at,
          completedAt: audit.completed_at,
          approvedAt: audit.approved_at,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      next(error);
    }
  };

  createAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { packageId, auditType, categoryIds, scheduledDate, contractorRep } = req.body;

      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        throw new AppError('At least one category must be selected', 400);
      }

      // Enforce audit-type scope so the type always matches the real coverage:
      //  - Focused = exactly one category (single-category deep-dive)
      //  - Partial = two or more categories (a subset)
      //  - Full    = all categories (selected automatically by the UI)
      if (auditType === 'Focused' && categoryIds.length !== 1) {
        throw new AppError('A Focused audit must cover exactly one category.', 400);
      }
      if (auditType === 'Partial' && categoryIds.length < 2) {
        throw new AppError('A Partial audit must cover at least two categories.', 400);
      }

      // Get package code and verify it belongs to the caller's project
      const packageResult = await db.query('SELECT code, project_id FROM packages WHERE id = $1', [packageId]);
      if (packageResult.rows.length === 0) {
        throw new AppError('Package not found', 404);
      }
      if (req.user!.roleName !== 'Super Admin' && packageResult.rows[0].project_id !== req.projectId) {
        throw new AppError('Access denied to this package', 403);
      }

      // Count total items for selected categories
      const itemCountResult = await db.query(
        `SELECT COUNT(*) FROM audit_items ai
         JOIN audit_sections s ON ai.section_id = s.id
         WHERE s.category_id = ANY($1) AND ai.is_active = true`,
        [categoryIds]
      );
      const totalItems = parseInt(itemCountResult.rows[0].count);

      // Create audit + category links atomically, retrying on audit number races
      const audit = await withUniqueRetry(() =>
        db.transaction(async (client) => {
          const auditNumber = await generateAuditNumber(client, packageResult.rows[0].code);

          const result = await client.query(
            `INSERT INTO audits (audit_number, package_id, audit_type, auditor_id, scheduled_date, contractor_rep, total_items, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft')
             RETURNING *`,
            [auditNumber, packageId, auditType, req.user!.id, scheduledDate || null, contractorRep || null, totalItems]
          );

          const created = result.rows[0];

          // Link categories to audit
          for (const categoryId of categoryIds) {
            await client.query(
              'INSERT INTO audit_category_selection (audit_id, category_id) VALUES ($1, $2)',
              [created.id, categoryId]
            );
          }

          return created;
        })
      );

      res.status(201).json({
        success: true,
        data: {
          id: audit.id,
          auditNumber: audit.audit_number,
          package: {
            id: packageId,
            code: packageResult.rows[0].code,
          },
          status: audit.status,
          totalItems: audit.total_items,
          createdAt: audit.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getAuditById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertAuditAccess(id, req);

      const result = await db.query(
        `SELECT a.*, p.code as package_code, p.name as package_name,
                u.name as auditor_name, u.email as auditor_email,
                r.name as reviewer_name
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         LEFT JOIN users u ON a.auditor_id = u.id
         LEFT JOIN users r ON a.reviewer_id = r.id
         WHERE a.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Audit not found', 404);
      }

      const audit = result.rows[0];

      // Get selected categories
      const categoriesResult = await db.query(
        `SELECT ac.*, acs.id as selection_id
         FROM audit_categories ac
         JOIN audit_category_selection acs ON ac.id = acs.category_id
         WHERE acs.audit_id = $1
         ORDER BY ac.display_order`,
        [id]
      );

      // Get ad-hoc (custom) checkpoints the auditor added to this audit.
      const customItemsResult = await db.query(
        `SELECT ai.id, ai.section_id, ai.sr_no, ai.audit_point, ai.standard_reference,
                ai.evidence_required, ai.priority, s.category_id, u.name AS created_by_name
         FROM audit_items ai
         JOIN audit_sections s ON ai.section_id = s.id
         LEFT JOIN users u ON ai.created_by = u.id
         WHERE ai.is_custom = true AND ai.created_in_audit_id = $1
         ORDER BY ai.section_id, ai.sr_no`,
        [id]
      );

      res.json({
        success: true,
        data: {
          id: audit.id,
          auditNumber: audit.audit_number,
          packageId: audit.package_id,
          package: {
            id: audit.package_id,
            code: audit.package_code,
            name: audit.package_name,
          },
          auditType: audit.audit_type,
          auditorId: audit.auditor_id,
          auditor: {
            id: audit.auditor_id,
            name: audit.auditor_name,
            email: audit.auditor_email,
          },
          reviewerId: audit.reviewer_id,
          reviewer: audit.reviewer_id ? { name: audit.reviewer_name } : null,
          contractorRep: audit.contractor_rep,
          scheduledDate: audit.scheduled_date,
          auditDate: audit.audit_date,
          status: audit.status,
          totalItems: audit.total_items,
          compliantCount: audit.compliant_count,
          nonCompliantCount: audit.non_compliant_count,
          naCount: audit.na_count,
          compliancePercentage: audit.compliance_percentage,
          categories: categoriesResult.rows.map((cat) => ({
            id: cat.id,
            code: cat.code,
            name: cat.name,
            type: cat.type,
          })),
          customItems: customItemsResult.rows.map((it) => ({
            id: it.id,
            sectionId: it.section_id,
            categoryId: it.category_id,
            srNo: it.sr_no,
            auditPoint: it.audit_point,
            standardReference: it.standard_reference,
            evidenceRequired: it.evidence_required,
            priority: it.priority,
            isCustom: true,
            createdByName: it.created_by_name,
          })),
          createdAt: audit.created_at,
          completedAt: audit.completed_at,
          approvedAt: audit.approved_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ---- Custom (ad-hoc) checkpoints added by an auditor during an audit ----

  addCustomItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { sectionId, auditPoint, standardReference, evidenceRequired, priority } = req.body;

      const audit = await assertAuditAccess(id, req);
      if (audit.locked_at || audit.status === 'Approved') {
        throw new AppError('Cannot modify a locked audit', 400);
      }
      if (!sectionId) throw new AppError('sectionId is required', 400);
      if (!auditPoint || !String(auditPoint).trim()) throw new AppError('Audit point text is required', 400);
      const pr = ['P1', 'P2', 'P3'].includes(priority) ? priority : 'P2';

      // The section must belong to a category selected for this audit
      const sec = await db.query(
        `SELECT s.id FROM audit_sections s
         JOIN audit_category_selection acs ON acs.category_id = s.category_id
         WHERE s.id = $1 AND acs.audit_id = $2`,
        [sectionId, id]
      );
      if (sec.rows.length === 0) throw new AppError('Section is not part of this audit', 400);

      // Next Sr No within this section (master items + this audit's custom items)
      const nextRes = await db.query(
        `SELECT COALESCE(MAX(sr_no), 0) + 1 AS n FROM audit_items
         WHERE section_id = $1 AND (is_custom = false OR created_in_audit_id = $2)`,
        [sectionId, id]
      );
      const srNo = nextRes.rows[0].n;

      const ins = await db.query(
        `INSERT INTO audit_items
           (section_id, sr_no, audit_point, standard_reference, evidence_required, priority,
            is_active, is_custom, created_in_audit_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, true, true, $7, $8)
         RETURNING id, section_id, sr_no, audit_point, standard_reference, evidence_required, priority`,
        [sectionId, srNo, String(auditPoint).trim(), standardReference || null, evidenceRequired || null, pr, id, req.user?.id || null]
      );
      const row = ins.rows[0];
      res.status(201).json({
        success: true,
        data: {
          id: row.id, sectionId: row.section_id, srNo: row.sr_no, auditPoint: row.audit_point,
          standardReference: row.standard_reference, evidenceRequired: row.evidence_required,
          priority: row.priority, isCustom: true,
        },
        message: 'Checkpoint added',
      });
    } catch (error) {
      next(error);
    }
  };

  updateCustomItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id, itemId } = req.params;
      const { auditPoint, standardReference, evidenceRequired, priority } = req.body;

      const audit = await assertAuditAccess(id, req);
      if (audit.locked_at || audit.status === 'Approved') {
        throw new AppError('Cannot modify a locked audit', 400);
      }
      const pr = priority && ['P1', 'P2', 'P3'].includes(priority) ? priority : null;

      const upd = await db.query(
        `UPDATE audit_items SET
           audit_point = COALESCE($1, audit_point),
           standard_reference = $2,
           evidence_required = $3,
           priority = COALESCE($4, priority)
         WHERE id = $5 AND is_custom = true AND created_in_audit_id = $6
         RETURNING id, section_id, sr_no, audit_point, standard_reference, evidence_required, priority`,
        [auditPoint ? String(auditPoint).trim() : null, standardReference || null, evidenceRequired || null, pr, itemId, id]
      );
      if (upd.rows.length === 0) throw new AppError('Custom checkpoint not found for this audit', 404);
      const row = upd.rows[0];
      res.json({
        success: true,
        data: {
          id: row.id, sectionId: row.section_id, srNo: row.sr_no, auditPoint: row.audit_point,
          standardReference: row.standard_reference, evidenceRequired: row.evidence_required,
          priority: row.priority, isCustom: true,
        },
        message: 'Checkpoint updated',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCustomItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id, itemId } = req.params;
      const audit = await assertAuditAccess(id, req);
      if (audit.locked_at || audit.status === 'Approved') {
        throw new AppError('Cannot modify a locked audit', 400);
      }
      await db.transaction(async (client) => {
        const chk = await client.query(
          `SELECT id FROM audit_items WHERE id = $1 AND is_custom = true AND created_in_audit_id = $2`,
          [itemId, id]
        );
        if (chk.rows.length === 0) throw new AppError('Custom checkpoint not found for this audit', 404);
        // Remove dependent response data, then the item itself.
        await client.query(`DELETE FROM audit_response_history WHERE response_id IN (SELECT id FROM audit_responses WHERE audit_item_id = $1)`, [itemId]);
        await client.query(`DELETE FROM audit_evidences WHERE response_id IN (SELECT id FROM audit_responses WHERE audit_item_id = $1)`, [itemId]);
        await client.query(`DELETE FROM capa WHERE response_id IN (SELECT id FROM audit_responses WHERE audit_item_id = $1)`, [itemId]);
        await client.query(`DELETE FROM audit_responses WHERE audit_item_id = $1`, [itemId]);
        await client.query(`DELETE FROM audit_items WHERE id = $1`, [itemId]);
      });
      res.json({ success: true, message: 'Checkpoint removed' });
    } catch (error) {
      next(error);
    }
  };

  updateAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { scheduledDate, contractorRep, auditDate } = req.body;

      const audit = await assertAuditAccess(id, req);
      if (audit.locked_at || audit.status === 'Approved') {
        throw new AppError('This audit has been approved and is locked. No changes allowed.', 409);
      }

      await db.query(
        `UPDATE audits SET
         scheduled_date = COALESCE($1, scheduled_date),
         contractor_rep = COALESCE($2, contractor_rep),
         audit_date = COALESCE($3, audit_date)
         WHERE id = $4`,
        [scheduledDate, contractorRep, auditDate, id]
      );

      res.json({
        success: true,
        message: 'Audit updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check audit exists, belongs to the caller's project, and is in Draft status
      const audit = await assertAuditAccess(id, req);
      if (audit.status !== 'Draft') {
        throw new AppError('Can only delete draft audits', 400);
      }

      await db.transaction(async (client) => {
        await client.query('DELETE FROM audit_category_selection WHERE audit_id = $1', [id]);
        await client.query('DELETE FROM audits WHERE id = $1', [id]);
      });

      res.json({
        success: true,
        message: 'Audit deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  submitAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertAuditAccess(id, req);

      // Get audit details before updating
      const auditResult = await db.query(
        `SELECT a.audit_number, a.package_id, p.code as package_code
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         WHERE a.id = $1`,
        [id]
      );

      // Each NC item must have SOME proof: a photo OR a written observation note.
      // (A missing document/register can't be photographed, so a note counts as
      // evidence for it; a physical hazard is proven with a photo.)
      const ncWithoutEvidence = await db.query(
        `SELECT ar.id, ai.sr_no, ai.audit_point, s.name as section_name
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audit_sections s ON ai.section_id = s.id
         LEFT JOIN audit_evidences ae ON ar.id = ae.response_id
         WHERE ar.audit_id = $1 AND ar.status = 'NC'
           AND COALESCE(TRIM(ar.observation), '') = ''
         GROUP BY ar.id, ai.sr_no, ai.audit_point, s.name
         HAVING COUNT(ae.id) = 0`,
        [id]
      );

      // Block submit only for NC items that have NEITHER a photo NOR a note.
      if (ncWithoutEvidence.rows.length > 0) {
        const missingItems = ncWithoutEvidence.rows.map((r: any) =>
          `${r.section_name} - Item ${r.sr_no}`
        );
        throw new AppError(
          `Cannot submit audit. Each NC item needs a photo OR a written observation. Missing on: ${missingItems.join(', ')}`,
          400
        );
      }

      // Submit + CAPA auto-creation must be atomic: a CAPA failure must not
      // leave the audit submitted with no CAPAs. Retried on CAPA number races.
      const capasCreated = await withUniqueRetry(() =>
        db.transaction(async (client) => {
          const updateResult = await client.query(
            `UPDATE audits SET status = 'Pending Review', completed_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status IN ('Draft', 'In Progress', 'Rejected')`,
            [id]
          );
          if (updateResult.rowCount === 0) {
            // Existence already verified above, so this is a workflow conflict
            throw new AppError('Only draft/in-progress audits can be submitted', 409);
          }

          // Auto-create a CAPA (client fix-task) for EVERY Non-Compliance item.
          // (Previously only NC items explicitly ticked "CAPA Required" became
          // CAPAs — an easy-to-miss step — so every NC now becomes a fix-task.)
          const capaRequiredResponses = await client.query(
            `SELECT ar.id as response_id, ar.observation, ai.audit_point, a.audit_number
             FROM audit_responses ar
             JOIN audit_items ai ON ar.audit_item_id = ai.id
             JOIN audits a ON ar.audit_id = a.id
             WHERE ar.audit_id = $1 AND ar.status = 'NC'
             AND NOT EXISTS (SELECT 1 FROM capa c WHERE c.response_id = ar.id)`,
            [id]
          );

          if (capaRequiredResponses.rows.length === 0) {
            return 0;
          }

          // Batch create CAPAs with sequential numbers
          const capaValues: any[] = [];
          const capaParams: string[] = [];
          let paramIndex = 1;

          for (let i = 0; i < capaRequiredResponses.rows.length; i++) {
            const response = capaRequiredResponses.rows[i];
            const capaNumber = await generateCapaNumber(client, i);
            capaValues.push(capaNumber, response.response_id, response.observation || response.audit_point);
            capaParams.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 'Open')`);
          }

          // Single batch INSERT instead of multiple queries
          await client.query(
            `INSERT INTO capa (capa_number, response_id, finding_description, status)
             VALUES ${capaParams.join(', ')}`,
            capaValues
          );

          return capaRequiredResponses.rows.length;
        })
      );

      // Notify PMC Heads and Package Managers (parallel, non-blocking)
      if (auditResult.rows.length > 0) {
        const { audit_number, package_id, package_code } = auditResult.rows[0];

        // Get all recipients in parallel
        const [pmcHeads, managers] = await Promise.all([
          getUsersByRole('PMC Head'),
          getPackageManagers(package_id)
        ]);

        // Create all notifications in parallel (non-blocking)
        const pmcNotifications = pmcHeads.map(userId =>
          createNotification(
            userId,
            'audit_submitted',
            'Audit Submitted for Review',
            `Audit ${audit_number} (Package ${package_code}) has been submitted for review`,
            {
              fromUserId: req.user?.id,
              entityType: 'audit',
              entityId: parseInt(id),
              actionUrl: `/audits/${id}`,
            }
          ).catch(err => logger.error('Failed to create PMC notification:', err))
        );

        const managerNotifications = managers.map(managerId =>
          createNotification(
            managerId,
            'audit_submitted',
            'Audit Submitted for Review',
            `Audit ${audit_number} has been submitted and is pending your review`,
            {
              fromUserId: req.user?.id,
              entityType: 'audit',
              entityId: parseInt(id),
              actionUrl: `/audits/${id}`,
            }
          ).catch(err => logger.error('Failed to create manager notification:', err))
        );

        // Fire-and-forget all notifications to prevent timeout
        Promise.all([...pmcNotifications, ...managerNotifications]).catch(() => {});
      }

      res.json({
        success: true,
        message: capasCreated > 0
          ? `Audit submitted for review. ${capasCreated} CAPA(s) created automatically.`
          : 'Audit submitted for review',
        capasCreated,
      });
    } catch (error) {
      next(error);
    }
  };

  approveAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      await assertAuditAccess(id, req);

      // Get audit details
      const auditResult = await db.query(
        `SELECT a.audit_number, a.auditor_id, p.code as package_code
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         WHERE a.id = $1`,
        [id]
      );

      // Approve and lock the audit (only audits pending review)
      const updateResult = await db.query(
        `UPDATE audits SET
         status = 'Approved',
         approved_at = CURRENT_TIMESTAMP,
         approved_by = $1,
         locked_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status = 'Pending Review'`,
        [req.user!.id, id]
      );
      if (updateResult.rowCount === 0) {
        throw new AppError('Only audits pending review can be approved', 409);
      }

      logger.info(`Audit ${id} approved and locked by user ${req.user!.id}`);

      // Notify the auditor
      if (auditResult.rows.length > 0) {
        const { audit_number, auditor_id, package_code } = auditResult.rows[0];
        if (auditor_id && auditor_id !== req.user!.id) {
          await createNotification(
            auditor_id,
            'audit_approved',
            'Audit Approved',
            `Your audit ${audit_number} (Package ${package_code}) has been approved`,
            {
              fromUserId: req.user?.id,
              entityType: 'audit',
              entityId: parseInt(id),
              actionUrl: `/audits/${id}`,
            }
          );
        }
      }

      res.json({
        success: true,
        message: 'Audit approved',
      });
    } catch (error) {
      next(error);
    }
  };

  rejectAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await assertAuditAccess(id, req);

      // Get audit details
      const auditResult = await db.query(
        `SELECT a.audit_number, a.auditor_id, p.code as package_code
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         WHERE a.id = $1`,
        [id]
      );

      const updateResult = await db.query(
        `UPDATE audits SET status = 'Rejected' WHERE id = $1 AND status = 'Pending Review'`,
        [id]
      );
      if (updateResult.rowCount === 0) {
        throw new AppError('Only audits pending review can be rejected', 409);
      }

      // Notify the auditor
      if (auditResult.rows.length > 0) {
        const { audit_number, auditor_id, package_code } = auditResult.rows[0];
        if (auditor_id && auditor_id !== req.user!.id) {
          await createNotification(
            auditor_id,
            'audit_rejected',
            'Audit Returned for Revision',
            `Your audit ${audit_number} (Package ${package_code}) requires revision${reason ? `: ${reason}` : ''}`,
            {
              fromUserId: req.user?.id,
              entityType: 'audit',
              entityId: parseInt(id),
              actionUrl: `/audits/${id}`,
              priority: 'high',
            }
          );
        }
      }

      res.json({
        success: true,
        message: 'Audit rejected',
      });
    } catch (error) {
      next(error);
    }
  };

  getAuditResponses = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertAuditAccess(id, req);

      const result = await db.query(
        `SELECT ar.*, ai.sr_no, ai.audit_point, ai.standard_reference, ai.priority,
                s.code as section_code, s.name as section_name,
                c.code as category_code, c.name as category_name,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', ae.id,
                      'fileName', ae.file_name,
                      'filePath', ae.file_path,
                      'fileType', ae.file_type,
                      'fileSize', ae.file_size
                    )
                  ) FILTER (WHERE ae.id IS NOT NULL), '[]'
                ) as evidence
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audit_sections s ON ai.section_id = s.id
         JOIN audit_categories c ON s.category_id = c.id
         LEFT JOIN audit_evidences ae ON ar.id = ae.response_id
         WHERE ar.audit_id = $1
         GROUP BY ar.id, ai.sr_no, ai.audit_point, ai.standard_reference, ai.priority,
                  s.code, s.name, s.display_order, c.code, c.name, c.display_order
         ORDER BY c.display_order, s.display_order, ai.sr_no`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows.map((response) => ({
          id: response.id,
          auditId: response.audit_id,
          auditItemId: response.audit_item_id,
          auditItem: {
            id: response.audit_item_id,
            srNo: response.sr_no,
            auditPoint: response.audit_point,
            standardReference: response.standard_reference,
            priority: response.priority,
            section: {
              code: response.section_code,
              name: response.section_name,
            },
            category: {
              code: response.category_code,
              name: response.category_name,
            },
          },
          status: response.status,
          observation: response.observation,
          riskRating: response.risk_rating,
          capaRequired: response.capa_required,
          remarks: response.remarks,
          evidence: response.evidence || [],
          createdAt: response.created_at,
          updatedAt: response.updated_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  saveAuditResponses = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { responses } = req.body;

      if (!Array.isArray(responses)) {
        throw new AppError('responses must be an array', 400);
      }

      // Check audit exists, belongs to the caller's project, and is not locked (approved)
      const audit = await assertAuditAccess(id, req);
      if (audit.status === 'Approved' || audit.locked_at) {
        throw new AppError('This audit has been approved and is locked. No changes allowed.', 403);
      }

      const savedCount = await db.transaction(async (client) => {
        let saved = 0;

        for (const response of responses) {
          // Get existing response for history tracking
          const existingResponse = await client.query(
            'SELECT * FROM audit_responses WHERE audit_id = $1 AND audit_item_id = $2',
            [id, response.auditItemId]
          );
          const oldData = existingResponse.rows[0] || null;
          const isUpdate = !!oldData;

          // Insert or update response
          const result = await client.query(
            `INSERT INTO audit_responses (audit_id, audit_item_id, status, observation, risk_rating, capa_required, remarks, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (audit_id, audit_item_id) DO UPDATE SET
             status = EXCLUDED.status,
             observation = EXCLUDED.observation,
             risk_rating = EXCLUDED.risk_rating,
             capa_required = EXCLUDED.capa_required,
             remarks = EXCLUDED.remarks,
             updated_by = EXCLUDED.updated_by,
             updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [
              id,
              response.auditItemId,
              response.status,
              response.observation || null,
              response.riskRating || null,
              response.capaRequired || false,
              response.remarks || null,
              req.user!.id,
            ]
          );

          // Log change to history
          await client.query(
            `INSERT INTO audit_response_history
             (response_id, audit_id, audit_item_id, action, old_status, new_status,
              old_observation, new_observation, old_risk_rating, new_risk_rating,
              old_capa_required, new_capa_required, old_remarks, new_remarks,
              changed_by, changed_by_name, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              result.rows[0].id,
              id,
              response.auditItemId,
              isUpdate ? 'updated' : 'created',
              oldData?.status ?? null,
              response.status,
              oldData?.observation ?? null,
              response.observation || null,
              oldData?.risk_rating ?? null,
              response.riskRating || null,
              oldData?.capa_required ?? null,
              response.capaRequired || false,
              oldData?.remarks ?? null,
              response.remarks || null,
              req.user!.id,
              req.user!.name,
              req.ip || null,
            ]
          );

          saved++;
        }

        // Recompute counts from ALL stored responses, not just this batch,
        // so partial saves don't corrupt the compliance figures
        const countsResult = await client.query(
          `SELECT status, COUNT(*) as count FROM audit_responses WHERE audit_id = $1 GROUP BY status`,
          [id]
        );

        let compliantCount = 0;
        let nonCompliantCount = 0;
        let naCount = 0;
        for (const row of countsResult.rows) {
          if (row.status === 'C') compliantCount = parseInt(row.count);
          else if (row.status === 'NC') nonCompliantCount = parseInt(row.count);
          else if (row.status === 'NA') naCount = parseInt(row.count);
        }

        // Compliance % = compliant / (answered - NA) * 100, guarding divide-by-zero
        const answeredExcludingNa = compliantCount + nonCompliantCount;
        const compliancePercentage = answeredExcludingNa > 0
          ? Math.round((compliantCount / answeredExcludingNa) * 100 * 10) / 10
          : null;

        await client.query(
          `UPDATE audits SET
           status = CASE WHEN status = 'Draft' THEN 'In Progress' ELSE status END,
           compliant_count = $1,
           non_compliant_count = $2,
           na_count = $3,
           compliance_percentage = $4
           WHERE id = $5`,
          [compliantCount, nonCompliantCount, naCount, compliancePercentage, id]
        );

        return saved;
      });

      res.json({
        success: true,
        data: {
          savedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  uploadEvidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { responseId } = req.params;

      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      // Verify the response exists, belongs to the caller's project (IDOR),
      // and the audit is not locked.
      const response = await assertResponseAccess(responseId, req);
      if (response.status === 'Approved' || response.locked_at) {
        throw new AppError('This audit has been approved and is locked. No changes allowed.', 403);
      }

      const result = await db.query(
        `INSERT INTO audit_evidences (response_id, file_name, file_path, file_type, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, file_path`,
        [
          responseId,
          req.file.originalname,
          req.file.path,
          req.file.mimetype,
          req.file.size,
          req.user!.id,
        ]
      );

      res.json({
        success: true,
        data: {
          fileId: result.rows[0].id,
          filePath: result.rows[0].file_path,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteEvidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { responseId, evidenceId } = req.params;

      // Verify the response exists, belongs to the caller's project (IDOR),
      // and the audit is not locked.
      const response = await assertResponseAccess(responseId, req);
      if (response.status === 'Approved' || response.locked_at) {
        throw new AppError('This audit has been approved and is locked. No changes allowed.', 403);
      }

      // Fetch the file path so we can remove it from disk after the DB delete.
      const evidence = await db.query(
        'SELECT file_path FROM audit_evidences WHERE id = $1 AND response_id = $2',
        [evidenceId, responseId]
      );

      await db.query(
        'DELETE FROM audit_evidences WHERE id = $1 AND response_id = $2',
        [evidenceId, responseId]
      );

      // Best-effort removal of the file on disk (ignore if already gone).
      if (evidence.rows.length > 0 && evidence.rows[0].file_path) {
        fs.promises.unlink(evidence.rows[0].file_path).catch((err) => {
          if (err.code !== 'ENOENT') {
            logger.error('Failed to delete evidence file from disk:', err);
          }
        });
      }

      res.json({
        success: true,
        message: 'Evidence deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  // Export audit to Word document with embedded photos
  exportToWord = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertAuditAccess(id, req);

      // Get audit details
      const auditResult = await db.query(
        `SELECT a.*, p.code as package_code, p.name as package_name,
                u.name as auditor_name
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         LEFT JOIN users u ON a.auditor_id = u.id
         WHERE a.id = $1`,
        [id]
      );

      if (auditResult.rows.length === 0) {
        throw new AppError('Audit not found', 404);
      }

      const audit = auditResult.rows[0];

      // Get NC responses with evidence
      const ncResponses = await db.query(
        `SELECT ar.*, ai.sr_no, ai.audit_point, ai.standard_reference, ai.priority,
                s.code as section_code, s.name as section_name,
                c.code as category_code, c.name as category_name,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', ae.id,
                      'fileName', ae.file_name,
                      'filePath', ae.file_path,
                      'fileType', ae.file_type
                    )
                  ) FILTER (WHERE ae.id IS NOT NULL), '[]'
                ) as evidence
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audit_sections s ON ai.section_id = s.id
         JOIN audit_categories c ON s.category_id = c.id
         LEFT JOIN audit_evidences ae ON ar.id = ae.response_id
         WHERE ar.audit_id = $1 AND ar.status = 'NC'
         GROUP BY ar.id, ai.sr_no, ai.audit_point, ai.standard_reference, ai.priority,
                  s.code, s.name, s.display_order, c.code, c.name, c.display_order
         ORDER BY c.display_order, s.display_order, ai.sr_no`,
        [id]
      );

      // Build document sections
      const docChildren: any[] = [];

      // Title
      docChildren.push(
        new Paragraph({
          text: 'EHS AUDIT REPORT',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      // Audit info
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Audit Number: ', bold: true }),
            new TextRun({ text: audit.audit_number }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Package: ', bold: true }),
            new TextRun({ text: `${audit.package_code} - ${audit.package_name}` }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Audit Date: ', bold: true }),
            new TextRun({ text: audit.audit_date ? new Date(audit.audit_date).toLocaleDateString() : 'N/A' }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Auditor: ', bold: true }),
            new TextRun({ text: audit.auditor_name || 'N/A' }),
          ],
          spacing: { after: 300 },
        })
      );

      // Full checklist results (ALL items, every status, WITH their evidence
      // photos) so the Word export is a complete audit report — compliant items
      // included, not just the non-conformances.
      const allResponses = await db.query(
        `SELECT ar.status, ar.observation, ai.sr_no, ai.audit_point, ai.is_custom,
                c.code as category_code, c.name as category_name,
                COALESCE(
                  json_agg(
                    json_build_object('filePath', ae.file_path, 'fileType', ae.file_type)
                  ) FILTER (WHERE ae.id IS NOT NULL), '[]'
                ) as evidence
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audit_sections s ON ai.section_id = s.id
         JOIN audit_categories c ON s.category_id = c.id
         LEFT JOIN audit_evidences ae ON ar.id = ae.response_id
         WHERE ar.audit_id = $1
         GROUP BY ar.id, ar.status, ar.observation, ai.sr_no, ai.audit_point, ai.is_custom,
                  c.code, c.name, c.display_order, s.display_order
         ORDER BY c.display_order, s.display_order, ai.sr_no`,
        [id]
      );

      const statusMeta: Record<string, { label: string; color: string }> = {
        C: { label: 'Compliant', color: '008000' },
        NC: { label: 'Non-Compliant', color: 'C00000' },
        NA: { label: 'N/A', color: '666666' },
        NV: { label: 'Not Verified', color: 'ED7D31' },
      };

      // Pre-compress every evidence image ONCE (resize to max 1000px + JPEG q70)
      // so the report stays small even with dozens of full-resolution photos.
      // .rotate() applies EXIF orientation so phone photos aren't sideways.
      const compressedImages = new Map<string, { data: Buffer; width: number; height: number }>();
      const evidencePaths = new Set<string>();
      for (const r of allResponses.rows) {
        for (const ev of (r.evidence || [])) {
          if (ev.filePath && ev.fileType && ev.fileType.startsWith('image/')) {
            evidencePaths.add(ev.filePath);
          }
        }
      }
      await Promise.all(
        Array.from(evidencePaths).map(async (fp) => {
          try {
            const fullPath = path.resolve(fp);
            if (!fs.existsSync(fullPath)) return;
            const data = await sharp(fullPath)
              .rotate()
              .resize({ width: 1000, withoutEnlargement: true })
              .jpeg({ quality: 70 })
              .toBuffer();
            const meta = await sharp(data).metadata();
            compressedImages.set(fp, { data, width: meta.width || 1000, height: meta.height || 750 });
          } catch (err) {
            logger.warn(`Could not compress evidence image: ${fp}`);
          }
        })
      );

      // Return a scaled docx Paragraph for a (pre-compressed) evidence image
      const buildEvidenceImage = (filePath?: string, fileType?: string) => {
        if (!filePath || !fileType || !fileType.startsWith('image/')) return null;
        const img = compressedImages.get(filePath);
        if (!img) return null;
        const maxW = 130, maxH = 110;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new ImageRun({
              data: img.data,
              transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
              type: 'jpg',
            }),
          ],
        });
      };

      // Group responses by category (preserving the audit's display order)
      const categoryGroups: { code: string; name: string; rows: any[] }[] = [];
      const catIndex = new Map<string, number>();
      for (const r of allResponses.rows) {
        // Items the auditor marked "Removed" (RM) are excluded from this audit
        // entirely: they must not appear in the report nor count toward totals.
        if (r.status === 'RM') continue;
        const key = `${r.category_code}|${r.category_name}`;
        if (!catIndex.has(key)) {
          catIndex.set(key, categoryGroups.length);
          categoryGroups.push({ code: r.category_code || '', name: r.category_name || '', rows: [] });
        }
        categoryGroups[catIndex.get(key)!].rows.push(r);
      }

      const countStatuses = (rows: any[]) => {
        let c = 0, nc = 0, na = 0, nv = 0;
        for (const r of rows) {
          if (r.status === 'C') c++;
          else if (r.status === 'NC') nc++;
          else if (r.status === 'NA') na++;
          else if (r.status === 'NV') nv++;
        }
        const denom = c + nc;
        const pct = denom > 0 ? Math.round((c / denom) * 1000) / 10 : null;
        return { c, nc, na, nv, total: rows.length, pct };
      };

      const mkHeaderCell = (text: string, size: number) =>
        new TableCell({
          shading: { fill: '1F4E79' },
          verticalAlign: VerticalAlign.CENTER,
          width: { size, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })] })],
        });

      if (allResponses.rows.length > 0) {
        // ---------- Category Summary table ----------
        docChildren.push(
          new Paragraph({
            text: 'Category Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          })
        );

        const numCell = (text: string, shading: string, bold = false, color = '000000') =>
          new TableCell({
            shading: { fill: shading },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold, color, size: 18 })] })],
          });

        const summaryHeader = new TableRow({
          tableHeader: true,
          children: [
            mkHeaderCell('Category', 44),
            mkHeaderCell('Items', 11),
            mkHeaderCell('Compliant', 13),
            mkHeaderCell('NC', 10),
            mkHeaderCell('N/A', 10),
            mkHeaderCell('Compliance %', 12),
          ],
        });

        const summaryRows = categoryGroups.map((g, i) => {
          const s = countStatuses(g.rows);
          const shading = i % 2 === 0 ? 'FFFFFF' : 'F5F5F5';
          return new TableRow({
            children: [
              new TableCell({
                shading: { fill: shading },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ children: [new TextRun({ text: `${g.code}. ${g.name}`, size: 18 })] })],
              }),
              numCell(String(s.total), shading),
              numCell(String(s.c), shading, false, '008000'),
              numCell(String(s.nc), shading, false, 'C00000'),
              numCell(String(s.na), shading),
              numCell(s.pct != null ? `${s.pct}%` : '-', shading, true),
            ],
          });
        });

        const overall = countStatuses(allResponses.rows);
        summaryRows.push(
          new TableRow({
            children: [
              new TableCell({ shading: { fill: 'DDEBF7' }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: 'Overall', bold: true, size: 18 })] })] }),
              numCell(String(overall.total), 'DDEBF7', true),
              numCell(String(overall.c), 'DDEBF7', true, '008000'),
              numCell(String(overall.nc), 'DDEBF7', true, 'C00000'),
              numCell(String(overall.na), 'DDEBF7', true),
              numCell(overall.pct != null ? `${overall.pct}%` : '-', 'DDEBF7', true),
            ],
          })
        );

        docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [summaryHeader, ...summaryRows] }));

        // ---------- Detailed checklist, one section per category ----------
        docChildren.push(
          new Paragraph({
            text: 'Detailed Checklist by Category',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 100 },
          })
        );

        for (const g of categoryGroups) {
          const s = countStatuses(g.rows);

          docChildren.push(
            new Paragraph({
              spacing: { before: 300, after: 100 },
              keepNext: true,
              children: [
                new TextRun({ text: `${g.code}. ${g.name}`, bold: true, size: 26, color: '1F4E79' }),
                new TextRun({ text: `   —   ${s.pct != null ? s.pct + '%' : 'N/A'} (${s.c} Compliant, ${s.nc} NC)`, size: 20, color: '666666' }),
              ],
            })
          );

          const header = new TableRow({
            tableHeader: true,
            children: [
              mkHeaderCell('S.No', 6),
              mkHeaderCell('Audit Point', 36),
              mkHeaderCell('Status', 12),
              mkHeaderCell('Observation', 18),
              mkHeaderCell('Evidence', 28),
            ],
          });

          const rows = g.rows.map((r: any, idx: number) => {
            const meta = statusMeta[r.status] || { label: r.status || '-', color: '000000' };
            const shading = idx % 2 === 0 ? 'FFFFFF' : 'F5F5F5';
            const cell = (children: Paragraph[]) =>
              new TableCell({ shading: { fill: shading }, verticalAlign: VerticalAlign.TOP, children });

            const evParas: Paragraph[] = [];
            for (const ev of (r.evidence || [])) {
              const p = buildEvidenceImage(ev.filePath, ev.fileType);
              if (p) evParas.push(p);
            }
            if (evParas.length === 0) {
              evParas.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '-', color: '999999', size: 16 })] }));
            }

            return new TableRow({
              children: [
                cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), size: 18 })] })]),
                cell([new Paragraph({ children: [new TextRun({ text: (r.audit_point || '') + (r.is_custom ? '  [Added]' : ''), size: 18 })] })]),
                cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.label, bold: true, color: meta.color, size: 18 })] })]),
                cell([new Paragraph({ children: [new TextRun({ text: r.observation || '', size: 18 })] })]),
                cell(evParas),
              ],
            });
          });

          docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }));
        }
      } else {
        docChildren.push(
          new Paragraph({
            text: 'No responses recorded for this audit yet.',
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
          })
        );
      }

      // NC Observations heading
      docChildren.push(
        new Paragraph({
          text: 'Non-Compliance Observations',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );

      // Table header row
      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'S.No', bold: true })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Evidence Photo', bold: true })] })],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Risk Level', bold: true })] })],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Reference & Recommendation', bold: true })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Remarks', bold: true })] })],
          }),
        ],
      });

      // Data rows
      const dataRows: TableRow[] = [];
      let serialNo = 1;

      for (const response of ncResponses.rows) {
        const evidence = response.evidence || [];
        const photoChildren: any[] = [];

        // Embed the pre-compressed photos with proper aspect ratio
        for (const photo of evidence) {
          if (photo.filePath && photo.fileType && photo.fileType.startsWith('image/')) {
            const img = compressedImages.get(photo.filePath);
            if (img) {
              const maxW = 150, maxH = 120;
              const scale = Math.min(maxW / img.width, maxH / img.height, 1);
              photoChildren.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: img.data,
                      transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
                      type: 'jpg',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 100 },
                })
              );
            }
          }
        }

        if (photoChildren.length === 0) {
          photoChildren.push(new Paragraph({ children: [new TextRun({ text: 'No photo', italics: true })] , alignment: AlignmentType.CENTER }));
        }

        // Determine risk level (P1 = High/Critical, P2 = Low/Medium)
        const riskLevel = response.risk_rating === 'High' || response.risk_rating === 'Critical' ? 'P1' : 'P2';

        // Reference and recommendation
        const reference = `${response.section_code || ''}: ${response.audit_point || ''}`;
        const standardRef = response.standard_reference ? `\nRef: ${response.standard_reference}` : '';

        dataRows.push(
          new TableRow({
            children: [
              // S.No
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ text: String(serialNo), alignment: AlignmentType.CENTER })],
              }),
              // Evidence Photo
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                children: photoChildren,
              }),
              // Risk Level
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: riskLevel,
                        bold: true,
                        color: riskLevel === 'P1' ? 'FF0000' : 'FFA500',
                      }),
                    ],
                  }),
                ],
              }),
              // Reference & Recommendation
              new TableCell({
                verticalAlign: VerticalAlign.TOP,
                children: [
                  new Paragraph({ children: [new TextRun({ text: reference })] }),
                  ...(standardRef ? [new Paragraph({ children: [new TextRun({ text: standardRef, italics: true, size: 20 })] })] : []),
                ],
              }),
              // Remarks
              new TableCell({
                verticalAlign: VerticalAlign.TOP,
                children: [
                  new Paragraph({ children: [new TextRun({ text: response.observation || '' })] }),
                  ...(response.remarks ? [new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: response.remarks })] })] : []),
                ],
              }),
            ],
          })
        );
        serialNo++;
      }

      // Create table
      if (dataRows.length > 0) {
        const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        });
        docChildren.push(table);
      } else {
        docChildren.push(
          new Paragraph({
            text: 'No non-compliance observations found.',
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
          })
        );
      }

      // Summary section
      docChildren.push(
        new Paragraph({
          text: 'Summary',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Total Items: ', bold: true }),
            new TextRun({ text: String(audit.total_items || 0) }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Compliant: ', bold: true }),
            new TextRun({ text: String(audit.compliant_count || 0) }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Non-Compliant: ', bold: true }),
            new TextRun({ text: String(audit.non_compliant_count || 0) }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Compliance Percentage: ', bold: true }),
            new TextRun({ text: `${audit.compliance_percentage || 0}%` }),
          ],
        })
      );

      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docChildren,
          },
        ],
      });

      // Generate buffer
      const buffer = await Packer.toBuffer(doc);

      // Send response
      const fileName = `${audit.audit_number}-Report.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // Export NC Observations Report - Professional format with logos and page numbers
  exportNCReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertAuditAccess(id, req);

      // Get audit details with project info (LEFT JOIN so an audit whose package
      // has no project still resolves instead of a misleading 404)
      const auditResult = await db.query(
        `SELECT a.*, p.code as package_code, p.name as package_name,
                pr.name as project_name, pr.client_name,
                u.name as auditor_name
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         LEFT JOIN projects pr ON p.project_id = pr.id
         LEFT JOIN users u ON a.auditor_id = u.id
         WHERE a.id = $1`,
        [id]
      );

      if (auditResult.rows.length === 0) {
        throw new AppError('Audit not found', 404);
      }

      const audit = auditResult.rows[0];
      const auditDate = audit.audit_date ? new Date(audit.audit_date) : new Date();
      const monthYear = auditDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      // Get NC responses with evidence
      const ncResponses = await db.query(
        `SELECT ar.*, ai.sr_no, ai.audit_point, ai.standard_reference, ai.evidence_required, ai.priority,
                s.code as section_code, s.name as section_name,
                c.code as category_code, c.name as category_name,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', ae.id,
                      'fileName', ae.file_name,
                      'filePath', ae.file_path,
                      'fileType', ae.file_type
                    )
                  ) FILTER (WHERE ae.id IS NOT NULL), '[]'
                ) as evidence
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audit_sections s ON ai.section_id = s.id
         JOIN audit_categories c ON s.category_id = c.id
         LEFT JOIN audit_evidences ae ON ar.id = ae.response_id
         WHERE ar.audit_id = $1 AND ar.status = 'NC'
         GROUP BY ar.id, ai.sr_no, ai.audit_point, ai.standard_reference, ai.evidence_required, ai.priority,
                  s.code, s.name, s.display_order, c.code, c.name, c.display_order
         ORDER BY c.display_order, s.display_order, ai.sr_no`,
        [id]
      );

      // Pre-compress every NC evidence image ONCE (resize to max 1000px + JPEG
      // q70, EXIF-rotated) so the report stays small even with many photos.
      const compressedImages = new Map<string, { data: Buffer; width: number; height: number }>();
      const ncEvidencePaths = new Set<string>();
      for (const r of ncResponses.rows) {
        for (const ev of (r.evidence || [])) {
          if (ev.filePath && ev.fileType && ev.fileType.startsWith('image/')) {
            ncEvidencePaths.add(ev.filePath);
          }
        }
      }
      await Promise.all(
        Array.from(ncEvidencePaths).map(async (fp) => {
          try {
            const fullPath = path.resolve(fp);
            if (!fs.existsSync(fullPath)) return;
            const data = await sharp(fullPath)
              .rotate()
              .resize({ width: 1000, withoutEnlargement: true })
              .jpeg({ quality: 70 })
              .toBuffer();
            const meta = await sharp(data).metadata();
            compressedImages.set(fp, { data, width: meta.width || 1000, height: meta.height || 750 });
          } catch (err) {
            logger.warn(`Could not compress NC evidence image: ${fp}`);
          }
        })
      );

      // Scale image to fit within max dimensions while preserving aspect ratio
      const scaleImage = (origWidth: number, origHeight: number, maxWidth: number, maxHeight: number) => {
        const widthRatio = maxWidth / origWidth;
        const heightRatio = maxHeight / origHeight;
        const scale = Math.min(widthRatio, heightRatio, 1); // Don't upscale
        return {
          width: Math.round(origWidth * scale),
          height: Math.round(origHeight * scale),
        };
      };

      // Try to load PROTECTHER logo
      let logoImage: Buffer | null = null;
      if (fs.existsSync(PROTECTHER_LOGO)) {
        logoImage = fs.readFileSync(PROTECTHER_LOGO);
      }

      // Build table rows
      const tableRows: TableRow[] = [];

      // Header cell helper — dark-blue fill, centered white bold text.
      // rowSpan/colSpan let the "Follow up" columns sit above two sub-columns.
      const hCell = (
        text: string,
        size: number,
        opts: { rowSpan?: number; columnSpan?: number } = {}
      ) =>
        new TableCell({
          width: { size, type: WidthType.PERCENTAGE },
          shading: { fill: '1F4E79', type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          rowSpan: opts.rowSpan,
          columnSpan: opts.columnSpan,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })],
            }),
          ],
        });

      // Two-row header. Existing columns span both rows; the two Follow-up
      // columns span two sub-columns each (Date | Remark).
      tableRows.push(
        new TableRow({
          tableHeader: true,
          height: { value: 400, rule: 'atLeast' as const },
          children: [
            hCell('S.No', 4, { rowSpan: 2 }),
            hCell('EVIDENCE PHOTOS', 14, { rowSpan: 2 }),
            hCell('Risk Level', 5, { rowSpan: 2 }),
            hCell('Reference & Recommendation', 20, { rowSpan: 2 }),
            hCell('Evidence Photos & Remarks', 15, { rowSpan: 2 }),
            hCell('Follow up 1', 15, { columnSpan: 2 }),
            hCell('Follow up 2', 15, { columnSpan: 2 }),
            hCell('Remark', 12, { rowSpan: 2 }),
          ],
        })
      );
      tableRows.push(
        new TableRow({
          tableHeader: true,
          height: { value: 300, rule: 'atLeast' as const },
          children: [
            hCell('Date', 6),
            hCell('Open / close', 9),
            hCell('Date', 6),
            hCell('Open / close', 9),
          ],
        })
      );

      // Blank Follow-up cells (FU1 Date | FU1 Remark | FU2 Date | FU2 Remark).
      // Left empty on purpose so the date and remark can be written by hand on
      // each follow-up visit. Widths match the sub-header above.
      const followUpCells = (rowShading: string) =>
        [6, 9, 6, 9].map(
          (w) =>
            new TableCell({
              width: { size: w, type: WidthType.PERCENTAGE },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [new TextRun({ text: '', size: 18 })] })],
            })
        );

      // Data rows
      let serialNo = 1;
      for (const response of ncResponses.rows) {
        const evidence = response.evidence || [];
        const imagePhotos: any[] = [];

        // Load evidence photos for left column (first 2 photos max)
        const leftPhotos: any[] = [];
        const rightPhotos: any[] = [];
        let photoIndex = 0;

        for (const photo of evidence) {
          if (photo.filePath && photo.fileType && photo.fileType.startsWith('image/')) {
            const imageInfo = compressedImages.get(photo.filePath);
            if (imageInfo) {
              // Scale to fit max 140x120 while preserving aspect ratio
              const scaled = scaleImage(imageInfo.width, imageInfo.height, 140, 120);

              const photoParagraph = new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                  new ImageRun({
                    data: imageInfo.data,
                    transformation: { width: scaled.width, height: scaled.height },
                    type: 'jpg',
                  }),
                ],
              });

              // Distribute photos: odd to left, even to right
              if (photoIndex % 2 === 0) {
                leftPhotos.push(photoParagraph);
              } else {
                rightPhotos.push(photoParagraph);
              }
              photoIndex++;
            }
          }
        }

        // If no photos, add placeholder
        if (leftPhotos.length === 0) {
          leftPhotos.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'No photo', italics: true, color: '666666' })],
            })
          );
        }
        if (rightPhotos.length === 0 && photoIndex > 0) {
          // Only add placeholder if we have some photos but none for right
          rightPhotos.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: '-', color: '666666' })],
            })
          );
        } else if (rightPhotos.length === 0) {
          rightPhotos.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'No photo', italics: true, color: '666666' })],
            })
          );
        }

        // Determine risk level: High/Critical -> P1, Major/Minor -> P2
        // (unified with exportToWord's mapping)
        const riskRating = response.risk_rating || 'Major';
        const isP1 = riskRating === 'Critical' || riskRating === 'High';
        const riskLevelText = isP1 ? 'P1' : 'P2';
        const riskColor = isP1 ? 'FF0000' : 'FF8C00'; // Red for P1, Orange for P2

        // Build reference & recommendation content
        const refChildren: Paragraph[] = [];

        // Category and observation
        refChildren.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `${response.category_name}`, bold: true, size: 20 }),
            ],
          })
        );

        // Audit point (observation)
        if (response.observation) {
          refChildren.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun({ text: response.observation, size: 20 })],
            })
          );
        } else if (response.audit_point) {
          refChildren.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun({ text: response.audit_point, size: 20 })],
            })
          );
        }

        // Standard reference
        if (response.standard_reference) {
          refChildren.push(
            new Paragraph({
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({ text: 'Reference: ', bold: true, size: 18 }),
                new TextRun({ text: response.standard_reference, italics: true, size: 18 }),
              ],
            })
          );
        }

        // Build remarks column content
        const remarksChildren: Paragraph[] = [];

        // Add photos to remarks column
        remarksChildren.push(...rightPhotos);

        // Add remarks text if present
        if (response.remarks) {
          remarksChildren.push(
            new Paragraph({
              spacing: { before: 100, after: 60 },
              children: [
                new TextRun({ text: 'Remarks: ', bold: true, size: 18 }),
                new TextRun({ text: response.remarks, size: 18 }),
              ],
            })
          );
        }

        // Alternate row background for better readability
        const rowShading = serialNo % 2 === 0 ? 'F5F5F5' : 'FFFFFF';

        // Create data row
        const dataRow = new TableRow({
          children: [
            // S.No
            new TableCell({
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(serialNo), bold: true, size: 22 })],
                }),
              ],
            }),
            // Evidence Photos (left column)
            new TableCell({
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: leftPhotos,
            }),
            // Risk Level
            new TableCell({
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: riskLevelText, bold: true, color: riskColor, size: 24 }),
                  ],
                }),
              ],
            }),
            // Reference & Recommendation
            new TableCell({
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.TOP,
              children: refChildren,
            }),
            // Evidence Photos & Remarks
            new TableCell({
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.TOP,
              children: remarksChildren.length > 0 ? remarksChildren : [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '-', color: '666666' })],
                }),
              ],
            }),
            // Follow up 1 & 2 — Date | Remark (blank, filled in by hand on revisits)
            ...followUpCells(rowShading),
            // Trailing Remark column (blank, for a final hand-written remark)
            new TableCell({
              width: { size: 12, type: WidthType.PERCENTAGE },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [new TextRun({ text: '', size: 18 })] })],
            }),
          ],
        });

        tableRows.push(dataRow);
        serialNo++;
      }

      // Create NC observations table
      const ncTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      });

      // Build document sections (children)
      const docChildren: any[] = [];

      // Section heading
      docChildren.push(
        new Paragraph({
          spacing: { before: 200, after: 300 },
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: '9. NC Observations', bold: true, size: 32 }),
          ],
        })
      );

      // Add table or "no observations" message
      if (ncResponses.rows.length > 0) {
        docChildren.push(ncTable);
      } else {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({ text: 'No non-compliance observations found for this audit.', italics: true, size: 24 }),
            ],
          })
        );
      }

      // Summary statistics
      docChildren.push(
        new Paragraph({
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: 'Summary', bold: true, size: 28 })],
        })
      );

      // Count P1 and P2 (same mapping as the Risk Level column: Critical/High = P1)
      const p1Count = ncResponses.rows.filter(
        (r: any) => r.risk_rating === 'Critical' || r.risk_rating === 'High'
      ).length;
      const p2Count = ncResponses.rows.length - p1Count;

      docChildren.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: 'Total NC Observations: ', bold: true, size: 22 }),
            new TextRun({ text: String(ncResponses.rows.length), size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: 'P1 (Critical/High): ', bold: true, color: 'FF0000', size: 22 }),
            new TextRun({ text: String(p1Count), size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: 'P2 (Major/Minor): ', bold: true, color: 'FF8C00', size: 22 }),
            new TextRun({ text: String(p2Count), size: 22 }),
          ],
        })
      );

      // Build header content with logo
      const headerContent: Paragraph[] = [];

      // Add logo if exists
      if (fs.existsSync(PROTECTHER_LOGO)) {
        try {
          const logoData = fs.readFileSync(PROTECTHER_LOGO);
          // Get logo dimensions
          let logoWidth = 1920, logoHeight = 540; // Default for this logo
          if (logoData[0] === 0x89 && logoData[1] === 0x50) { // PNG
            logoWidth = logoData.readUInt32BE(16);
            logoHeight = logoData.readUInt32BE(20);
          }
          // Scale logo to fit header (max width 200px)
          const scale = Math.min(200 / logoWidth, 60 / logoHeight);
          const scaledWidth = Math.round(logoWidth * scale);
          const scaledHeight = Math.round(logoHeight * scale);

          headerContent.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [
                new ImageRun({
                  data: logoData,
                  transformation: { width: scaledWidth, height: scaledHeight },
                  type: 'png',
                }),
              ],
            })
          );
        } catch (err) {
          logger.warn('Could not load logo for header');
        }
      }

      // Title row
      headerContent.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: 'EHS AUDIT REPORT',
              bold: true,
              size: 32,
              color: '1F4E79',
            }),
          ],
        })
      );

      // Project and date info
      headerContent.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 },
          children: [
            new TextRun({
              text: `${audit.project_name || 'Project'} | ${monthYear}`,
              size: 22,
              color: '666666',
            }),
          ],
        })
      );

      // Package info
      headerContent.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Package: ${audit.package_code} - ${audit.package_name}`,
              size: 20,
              color: '888888',
            }),
          ],
        })
      );

      // Create document with header and footer
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                // Landscape A4 — the extra width gives the Follow-up 1/2
                // columns room without cramping the others. Pass the A4
                // portrait dimensions (210 x 297mm); the docx library swaps
                // width/height itself when orientation is LANDSCAPE.
                size: {
                  orientation: PageOrientation.LANDSCAPE,
                  width: convertMillimetersToTwip(210),
                  height: convertMillimetersToTwip(297),
                },
                margin: {
                  top: convertInchesToTwip(1),
                  bottom: convertInchesToTwip(0.75),
                  left: convertInchesToTwip(0.5),
                  right: convertInchesToTwip(0.5),
                },
              },
            },
            headers: {
              default: new Header({
                children: headerContent,
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: 'PROTECTHER Safety Consultants | ', size: 18, color: '666666' }),
                      new TextRun({ text: 'Page ', size: 18 }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: 18,
                      }),
                      new TextRun({ text: ' of ', size: 18 }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        size: 18,
                      }),
                    ],
                  }),
                ],
              }),
            },
            children: docChildren,
          },
        ],
      });

      // Generate buffer and send response
      const buffer = await Packer.toBuffer(doc);
      const fileName = `NC-Observations-${audit.audit_number}-${monthYear.replace(' ', '-')}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // Get audit comments
  getAuditComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertAuditAccess(id, req);

      const result = await db.query(
        `SELECT ac.*, u.name as user_name, u.email as user_email
         FROM audit_comments ac
         JOIN users u ON ac.user_id = u.id
         WHERE ac.audit_id = $1
         ORDER BY ac.created_at DESC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows.map((comment) => ({
          id: comment.id,
          auditId: comment.audit_id,
          userId: comment.user_id,
          user: {
            id: comment.user_id,
            name: comment.user_name,
            email: comment.user_email,
          },
          comment: comment.comment,
          commentType: comment.comment_type,
          isInternal: comment.is_internal,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // Add audit comment
  addAuditComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { comment, commentType, isInternal } = req.body;

      if (!comment || comment.trim() === '') {
        throw new AppError('Comment is required', 400);
      }

      await assertAuditAccess(id, req);

      const result = await db.query(
        `INSERT INTO audit_comments (audit_id, user_id, comment, comment_type, is_internal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, req.user!.id, comment.trim(), commentType || 'general', isInternal || false]
      );

      res.status(201).json({
        success: true,
        data: {
          id: result.rows[0].id,
          comment: result.rows[0].comment,
          commentType: result.rows[0].comment_type,
          isInternal: result.rows[0].is_internal,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete audit comment
  deleteAuditComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id, commentId } = req.params;

      await assertAuditAccess(id, req);

      // Only allow deletion by comment author or admin
      const commentResult = await db.query(
        'SELECT user_id FROM audit_comments WHERE id = $1 AND audit_id = $2',
        [commentId, id]
      );

      if (commentResult.rows.length === 0) {
        throw new AppError('Comment not found', 404);
      }

      if (commentResult.rows[0].user_id !== req.user!.id &&
          req.user!.roleName !== 'Super Admin') {
        throw new AppError('Not authorized to delete this comment', 403);
      }

      await db.query('DELETE FROM audit_comments WHERE id = $1', [commentId]);

      res.json({
        success: true,
        message: 'Comment deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get audit attachments
  getAuditAttachments = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertAuditAccess(id, req);

      const result = await db.query(
        `SELECT aa.*, u.name as uploader_name
         FROM audit_attachments aa
         LEFT JOIN users u ON aa.uploaded_by = u.id
         WHERE aa.audit_id = $1
         ORDER BY aa.uploaded_at DESC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows.map((attachment) => ({
          id: attachment.id,
          auditId: attachment.audit_id,
          fileName: attachment.file_name,
          filePath: attachment.file_path,
          fileType: attachment.file_type,
          fileSize: attachment.file_size,
          description: attachment.description,
          uploadedBy: attachment.uploaded_by,
          uploaderName: attachment.uploader_name,
          uploadedAt: attachment.uploaded_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // Upload audit attachment
  uploadAuditAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { description } = req.body;

      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      await assertAuditAccess(id, req);

      const result = await db.query(
        `INSERT INTO audit_attachments (audit_id, file_name, file_path, file_type, file_size, description, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          req.file.originalname,
          req.file.path,
          req.file.mimetype,
          req.file.size,
          description || null,
          req.user!.id,
        ]
      );

      res.status(201).json({
        success: true,
        data: {
          id: result.rows[0].id,
          fileName: result.rows[0].file_name,
          filePath: result.rows[0].file_path,
          fileType: result.rows[0].file_type,
          fileSize: result.rows[0].file_size,
          uploadedAt: result.rows[0].uploaded_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete audit attachment
  deleteAuditAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id, attachmentId } = req.params;

      await assertAuditAccess(id, req);

      // Check if attachment exists
      const attachmentResult = await db.query(
        'SELECT * FROM audit_attachments WHERE id = $1 AND audit_id = $2',
        [attachmentId, id]
      );

      if (attachmentResult.rows.length === 0) {
        throw new AppError('Attachment not found', 404);
      }

      // Delete file from filesystem
      const filePath = attachmentResult.rows[0].file_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await db.query('DELETE FROM audit_attachments WHERE id = $1', [attachmentId]);

      res.json({
        success: true,
        message: 'Attachment deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get audit response change history
  getAuditHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { responseId } = req.query;

      await assertAuditAccess(id, req);

      let query = `
        SELECT arh.*, ai.sr_no, ai.audit_point, s.name as section_name
        FROM audit_response_history arh
        LEFT JOIN audit_items ai ON arh.audit_item_id = ai.id
        LEFT JOIN audit_sections s ON ai.section_id = s.id
        WHERE arh.audit_id = $1
      `;
      const params: any[] = [id];

      if (responseId) {
        query += ` AND arh.response_id = $2`;
        params.push(responseId);
      }

      query += ` ORDER BY arh.changed_at DESC LIMIT 100`;

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((h: any) => ({
          id: h.id,
          responseId: h.response_id,
          auditItemId: h.audit_item_id,
          auditItem: h.audit_point ? {
            srNo: h.sr_no,
            auditPoint: h.audit_point,
            sectionName: h.section_name,
          } : null,
          action: h.action,
          changes: {
            status: { old: h.old_status, new: h.new_status },
            observation: { old: h.old_observation, new: h.new_observation },
            riskRating: { old: h.old_risk_rating, new: h.new_risk_rating },
            capaRequired: { old: h.old_capa_required, new: h.new_capa_required },
            remarks: { old: h.old_remarks, new: h.new_remarks },
          },
          changedBy: {
            id: h.changed_by,
            name: h.changed_by_name,
          },
          changedAt: h.changed_at,
          ipAddress: h.ip_address,
        })),
      });
    } catch (error) {
      next(error);
    }
  };
}
