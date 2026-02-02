import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createNotification, getPackageManagers } from './notification.controller';

export class CAPAController {
  getAllCAPA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page = 1, pageSize = 20, status, packageId } = req.query;
      const offset = (Number(page) - 1) * Number(pageSize);

      let query = `
        SELECT c.*, ar.status as response_status, ai.audit_point,
               a.audit_number, p.code as package_code, p.name as package_name
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audit_items ai ON ar.audit_item_id = ai.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND c.status = $${paramIndex++}`;
        params.push(status);
      }

      if (packageId) {
        query += ` AND a.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      // Get total count
      const countResult = await db.query(
        query.replace('SELECT c.*, ar.status as response_status, ai.audit_point,', 'SELECT COUNT(*)').replace('a.audit_number, p.code as package_code, p.name as package_name', ''),
        params
      );

      query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(Number(pageSize), offset);

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((capa) => ({
          id: capa.id,
          capaNumber: capa.capa_number,
          responseId: capa.response_id,
          auditNumber: capa.audit_number,
          packageCode: capa.package_code,
          packageName: capa.package_name,
          auditPoint: capa.audit_point,
          findingDescription: capa.finding_description,
          rootCause: capa.root_cause,
          correctiveAction: capa.corrective_action,
          preventiveAction: capa.preventive_action,
          responsiblePerson: capa.responsible_person,
          responsibleDept: capa.responsible_dept,
          targetDate: capa.target_date,
          status: capa.status,
          closedDate: capa.closed_date,
          createdAt: capa.created_at,
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

  createCAPA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        responseId,
        findingDescription,
        rootCause,
        correctiveAction,
        preventiveAction,
        responsiblePerson,
        responsibleDept,
        targetDate,
      } = req.body;

      // Generate CAPA number
      const countResult = await db.query(
        'SELECT COUNT(*) FROM capa WHERE EXTRACT(YEAR FROM created_at) = $1',
        [new Date().getFullYear()]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      const capaNumber = `CAPA-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

      const result = await db.query(
        `INSERT INTO capa (capa_number, response_id, finding_description, root_cause, corrective_action,
         preventive_action, responsible_person, responsible_dept, target_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Open')
         RETURNING *`,
        [
          capaNumber,
          responseId,
          findingDescription,
          rootCause || null,
          correctiveAction || null,
          preventiveAction || null,
          responsiblePerson || null,
          responsibleDept || null,
          targetDate || null,
        ]
      );

      // Get audit info for notification
      const auditInfo = await db.query(
        `SELECT a.audit_number, a.package_id, p.code as package_code
         FROM audit_responses ar
         JOIN audits a ON ar.audit_id = a.id
         JOIN packages p ON a.package_id = p.id
         WHERE ar.id = $1`,
        [responseId]
      );

      if (auditInfo.rows.length > 0) {
        const { audit_number, package_id, package_code } = auditInfo.rows[0];

        // Notify package managers
        const managers = await getPackageManagers(package_id);
        for (const managerId of managers) {
          await createNotification(
            managerId,
            'capa_assigned',
            'New CAPA Created',
            `CAPA ${capaNumber} has been created for audit ${audit_number} (Package ${package_code})`,
            {
              fromUserId: req.user?.id,
              entityType: 'capa',
              entityId: result.rows[0].id,
              actionUrl: `/capa?id=${result.rows[0].id}`,
              priority: 'high',
            }
          );
        }
      }

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  };

  getCAPAById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT c.*, ar.status as response_status, ai.audit_point, ai.standard_reference,
                a.audit_number, p.code as package_code, p.name as package_name,
                v.name as verifier_name
         FROM capa c
         JOIN audit_responses ar ON c.response_id = ar.id
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audits a ON ar.audit_id = a.id
         JOIN packages p ON a.package_id = p.id
         LEFT JOIN users v ON c.verified_by = v.id
         WHERE c.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('CAPA not found', 404);
      }

      const capa = result.rows[0];

      res.json({
        success: true,
        data: {
          id: capa.id,
          capaNumber: capa.capa_number,
          responseId: capa.response_id,
          auditNumber: capa.audit_number,
          packageCode: capa.package_code,
          packageName: capa.package_name,
          auditPoint: capa.audit_point,
          standardReference: capa.standard_reference,
          findingDescription: capa.finding_description,
          rootCause: capa.root_cause,
          correctiveAction: capa.corrective_action,
          preventiveAction: capa.preventive_action,
          responsiblePerson: capa.responsible_person,
          responsibleDept: capa.responsible_dept,
          targetDate: capa.target_date,
          status: capa.status,
          closedDate: capa.closed_date,
          verifiedBy: capa.verified_by,
          verifierName: capa.verifier_name,
          verificationRemarks: capa.verification_remarks,
          createdAt: capa.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateCAPA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        rootCause,
        correctiveAction,
        preventiveAction,
        responsiblePerson,
        responsibleDept,
        targetDate,
        status,
      } = req.body;

      await db.query(
        `UPDATE capa SET
         root_cause = COALESCE($1, root_cause),
         corrective_action = COALESCE($2, corrective_action),
         preventive_action = COALESCE($3, preventive_action),
         responsible_person = COALESCE($4, responsible_person),
         responsible_dept = COALESCE($5, responsible_dept),
         target_date = COALESCE($6, target_date),
         status = COALESCE($7, status)
         WHERE id = $8`,
        [rootCause, correctiveAction, preventiveAction, responsiblePerson, responsibleDept, targetDate, status, id]
      );

      res.json({
        success: true,
        message: 'CAPA updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  closeCAPA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { verificationRemarks } = req.body;

      // Get CAPA details before closing
      const capaResult = await db.query(
        `SELECT c.capa_number, a.auditor_id, a.package_id
         FROM capa c
         JOIN audit_responses ar ON c.response_id = ar.id
         JOIN audits a ON ar.audit_id = a.id
         WHERE c.id = $1`,
        [id]
      );

      await db.query(
        `UPDATE capa SET
         status = 'Closed',
         closed_date = CURRENT_DATE,
         verified_by = $1,
         verification_remarks = $2
         WHERE id = $3`,
        [req.user!.id, verificationRemarks || null, id]
      );

      // Notify the auditor that CAPA was verified
      if (capaResult.rows.length > 0) {
        const { capa_number, auditor_id } = capaResult.rows[0];
        if (auditor_id && auditor_id !== req.user!.id) {
          await createNotification(
            auditor_id,
            'capa_verified',
            'CAPA Verified & Closed',
            `${capa_number} has been verified and closed`,
            {
              fromUserId: req.user?.id,
              entityType: 'capa',
              entityId: parseInt(id),
              actionUrl: `/capa?id=${id}`,
            }
          );
        }
      }

      res.json({
        success: true,
        message: 'CAPA closed successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
