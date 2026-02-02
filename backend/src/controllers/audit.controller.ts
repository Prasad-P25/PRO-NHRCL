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
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

export class AuditController {
  getAllAudits = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page = 1, pageSize = 20, packageId, status, auditorId } = req.query;
      const offset = (Number(page) - 1) * Number(pageSize);

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

      // Package filter based on user role
      if (req.user!.roleName !== 'Super Admin' && req.user!.roleName !== 'PMC Head') {
        if (req.user!.packageId) {
          query += ` AND a.package_id = $${paramIndex++}`;
          params.push(req.user!.packageId);
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

      // Get total count
      const countResult = await db.query(
        query.replace(/SELECT a\.\*, p\.code.*FROM/, 'SELECT COUNT(*) FROM'),
        params
      );

      // Add pagination
      query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(Number(pageSize), offset);

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
        total: parseInt(countResult.rows[0].count),
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / Number(pageSize)),
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

      // Get package code
      const packageResult = await db.query('SELECT code FROM packages WHERE id = $1', [packageId]);
      if (packageResult.rows.length === 0) {
        throw new AppError('Package not found', 404);
      }

      // Generate audit number
      const year = new Date().getFullYear();
      const countResult = await db.query(
        'SELECT COUNT(*) FROM audits WHERE package_id = $1 AND EXTRACT(YEAR FROM created_at) = $2',
        [packageId, year]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      const auditNumber = `AUD-${packageResult.rows[0].code}-${year}-${String(count).padStart(3, '0')}`;

      // Count total items for selected categories
      const itemCountResult = await db.query(
        `SELECT COUNT(*) FROM audit_items ai
         JOIN audit_sections s ON ai.section_id = s.id
         WHERE s.category_id = ANY($1) AND ai.is_active = true`,
        [categoryIds]
      );
      const totalItems = parseInt(itemCountResult.rows[0].count);

      // Create audit
      const result = await db.query(
        `INSERT INTO audits (audit_number, package_id, audit_type, auditor_id, scheduled_date, contractor_rep, total_items, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft')
         RETURNING *`,
        [auditNumber, packageId, auditType, req.user!.id, scheduledDate || null, contractorRep || null, totalItems]
      );

      const audit = result.rows[0];

      // Link categories to audit
      for (const categoryId of categoryIds) {
        await db.query(
          'INSERT INTO audit_category_selection (audit_id, category_id) VALUES ($1, $2)',
          [audit.id, categoryId]
        );
      }

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
          createdAt: audit.created_at,
          completedAt: audit.completed_at,
          approvedAt: audit.approved_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateAudit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { scheduledDate, contractorRep, auditDate } = req.body;

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

      // Check if audit is in Draft status
      const auditResult = await db.query('SELECT status FROM audits WHERE id = $1', [id]);
      if (auditResult.rows.length === 0) {
        throw new AppError('Audit not found', 404);
      }
      if (auditResult.rows[0].status !== 'Draft') {
        throw new AppError('Can only delete draft audits', 400);
      }

      await db.query('DELETE FROM audit_category_selection WHERE audit_id = $1', [id]);
      await db.query('DELETE FROM audits WHERE id = $1', [id]);

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

      // Get audit details before updating
      const auditResult = await db.query(
        `SELECT a.audit_number, a.package_id, p.code as package_code
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         WHERE a.id = $1`,
        [id]
      );

      await db.query(
        `UPDATE audits SET status = 'Pending Review', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );

      // Auto-create CAPAs for items marked as "CAPA Required"
      // Debug: Check all responses for this audit
      const allResponses = await db.query(
        `SELECT ar.id, ar.status, ar.capa_required, ar.observation
         FROM audit_responses ar WHERE ar.audit_id = $1`,
        [id]
      );
      logger.info(`Audit ${id}: Found ${allResponses.rows.length} total responses`);
      // Log each response for debugging
      allResponses.rows.forEach((r: any, idx: number) => {
        logger.info(`Audit ${id} Response ${idx}: status=${r.status}, capa_required=${r.capa_required} (type: ${typeof r.capa_required})`);
      });
      // Handle both boolean true and string 't' from PostgreSQL
      const ncWithCapa = allResponses.rows.filter((r: any) =>
        r.status === 'NC' && (r.capa_required === true || r.capa_required === 't')
      );
      logger.info(`Audit ${id}: Found ${ncWithCapa.length} NC responses with capa_required=true`);

      const capaRequiredResponses = await db.query(
        `SELECT ar.id as response_id, ar.observation, ai.audit_point, a.audit_number
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audits a ON ar.audit_id = a.id
         WHERE ar.audit_id = $1 AND ar.capa_required = true AND ar.status = 'NC'
         AND NOT EXISTS (SELECT 1 FROM capa c WHERE c.response_id = ar.id)`,
        [id]
      );
      logger.info(`Audit ${id}: Query returned ${capaRequiredResponses.rows.length} eligible for CAPA creation`);

      let capasCreated = 0;
      for (const response of capaRequiredResponses.rows) {
        // Generate CAPA number
        const year = new Date().getFullYear();
        const countResult = await db.query(
          `SELECT COUNT(*) FROM capa WHERE capa_number LIKE $1`,
          [`CAPA-${year}-%`]
        );
        const nextNum = parseInt(countResult.rows[0].count) + 1;
        const capaNumber = `CAPA-${year}-${String(nextNum).padStart(3, '0')}`;

        // Create CAPA
        await db.query(
          `INSERT INTO capa (capa_number, response_id, finding_description, status)
           VALUES ($1, $2, $3, 'Open')`,
          [capaNumber, response.response_id, response.observation || response.audit_point]
        );
        capasCreated++;
      }

      // Notify PMC Heads and Package Managers
      if (auditResult.rows.length > 0) {
        const { audit_number, package_id, package_code } = auditResult.rows[0];

        // Notify PMC Heads
        const pmcHeads = await getUsersByRole('PMC Head');
        for (const userId of pmcHeads) {
          await createNotification(
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
          );
        }

        // Notify Package Managers
        const managers = await getPackageManagers(package_id);
        for (const managerId of managers) {
          await createNotification(
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
          );
        }
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

      // Get audit details
      const auditResult = await db.query(
        `SELECT a.audit_number, a.auditor_id, p.code as package_code
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         WHERE a.id = $1`,
        [id]
      );

      await db.query(
        `UPDATE audits SET
         status = 'Approved',
         approved_at = CURRENT_TIMESTAMP,
         approved_by = $1
         WHERE id = $2`,
        [req.user!.id, id]
      );

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

      // Get audit details
      const auditResult = await db.query(
        `SELECT a.audit_number, a.auditor_id, p.code as package_code
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         WHERE a.id = $1`,
        [id]
      );

      await db.query(
        `UPDATE audits SET status = 'Rejected' WHERE id = $1`,
        [id]
      );

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

      let savedCount = 0;
      let compliantCount = 0;
      let nonCompliantCount = 0;
      let naCount = 0;

      for (const response of responses) {
        await db.query(
          `INSERT INTO audit_responses (audit_id, audit_item_id, status, observation, risk_rating, capa_required, remarks, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (audit_id, audit_item_id) DO UPDATE SET
           status = EXCLUDED.status,
           observation = EXCLUDED.observation,
           risk_rating = EXCLUDED.risk_rating,
           capa_required = EXCLUDED.capa_required,
           remarks = EXCLUDED.remarks,
           updated_by = EXCLUDED.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
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

        savedCount++;
        if (response.status === 'C') compliantCount++;
        else if (response.status === 'NC') nonCompliantCount++;
        else if (response.status === 'NA') naCount++;
      }

      // Update audit counts
      const totalResponses = compliantCount + nonCompliantCount;
      const compliancePercentage = totalResponses > 0
        ? Math.round((compliantCount / totalResponses) * 100 * 10) / 10
        : null;

      await db.query(
        `UPDATE audits SET
         status = CASE WHEN status = 'Draft' THEN 'In Progress' ELSE status END,
         compliant_count = $1,
         non_compliant_count = $2,
         na_count = $3,
         compliance_percentage = $4
         WHERE id = $5`,
        [compliantCount, nonCompliantCount, naCount, compliancePercentage, id]
      );

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

      await db.query(
        'DELETE FROM audit_evidences WHERE id = $1 AND response_id = $2',
        [evidenceId, responseId]
      );

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
            children: [new Paragraph({ text: 'S.No', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'S.No', bold: true })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ text: 'Evidence Photo', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Evidence Photo', bold: true })] })],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ text: 'Risk Level', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Risk Level', bold: true })] })],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ text: 'Reference & Recommendation', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Reference & Recommendation', bold: true })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: 'CCCCCC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ text: 'Remarks', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Remarks', bold: true })] })],
          }),
        ],
      });

      // Data rows
      const dataRows: TableRow[] = [];
      let serialNo = 1;

      for (const response of ncResponses.rows) {
        const evidence = response.evidence || [];
        const photoChildren: any[] = [];

        // Load and embed photos
        for (const photo of evidence) {
          if (photo.filePath && photo.fileType && photo.fileType.startsWith('image/')) {
            try {
              const fullPath = path.resolve(photo.filePath);
              if (fs.existsSync(fullPath)) {
                const imageData = fs.readFileSync(fullPath);
                photoChildren.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: imageData,
                        transformation: {
                          width: 150,
                          height: 100,
                        },
                        type: 'png',
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 100 },
                  })
                );
              }
            } catch (err) {
              logger.error(`Failed to load image: ${photo.filePath}`, err);
            }
          }
        }

        if (photoChildren.length === 0) {
          photoChildren.push(new Paragraph({ text: 'No photo', alignment: AlignmentType.CENTER }));
        }

        // Determine risk level (NC1 = High/Critical, NC2 = Low/Medium)
        const riskLevel = response.risk_rating === 'High' || response.risk_rating === 'Critical' ? 'NC1' : 'NC2';

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
                        color: riskLevel === 'NC1' ? 'FF0000' : 'FFA500',
                      }),
                    ],
                  }),
                ],
              }),
              // Reference & Recommendation
              new TableCell({
                verticalAlign: VerticalAlign.TOP,
                children: [
                  new Paragraph({ text: reference }),
                  ...(standardRef ? [new Paragraph({ text: standardRef, children: [new TextRun({ text: standardRef, italics: true, size: 20 })] })] : []),
                ],
              }),
              // Remarks
              new TableCell({
                verticalAlign: VerticalAlign.TOP,
                children: [
                  new Paragraph({ text: response.observation || '' }),
                  ...(response.remarks ? [new Paragraph({ text: response.remarks, spacing: { before: 100 } })] : []),
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
}
