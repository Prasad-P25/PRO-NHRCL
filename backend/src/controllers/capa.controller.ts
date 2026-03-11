import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createNotification, getPackageManagers, getPackageManagersWithEmail, getUserEmail } from './notification.controller';
import { emailService } from '../services/email.service';
import { format } from 'date-fns';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export class CAPAController {
  getAllCAPA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page = 1, pageSize = 20, status, packageId } = req.query;
      const offset = (Number(page) - 1) * Number(pageSize);
      const projectId = req.projectId;

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

      // Project filter
      if (projectId) {
        query += ` AND p.project_id = $${paramIndex++}`;
        params.push(projectId);
      }

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

        // Notify package managers (in-app + email)
        const managers = await getPackageManagersWithEmail(package_id);
        for (const manager of managers) {
          // In-app notification
          await createNotification(
            manager.id,
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

          // Send email notification
          await emailService.sendCapaCreated(manager.email, {
            capaNumber,
            auditNumber: audit_number,
            finding: findingDescription.substring(0, 200) + (findingDescription.length > 200 ? '...' : ''),
            assigneeName: manager.name,
            dueDate: targetDate ? format(new Date(targetDate), 'PPP') : 'Not set',
            link: `${APP_URL}/capa?id=${result.rows[0].id}`,
          });
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

  // CAPA Analytics endpoint
  getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = req.projectId;
      const projectFilter = projectId ? `AND p.project_id = ${projectId}` : '';

      // Status breakdown
      const statusResult = await db.query(`
        SELECT c.status, COUNT(*) as count
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE 1=1 ${projectFilter}
        GROUP BY c.status
      `);

      // Overdue analysis
      const overdueResult = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE c.target_date < CURRENT_DATE AND c.status != 'Closed') as overdue,
          COUNT(*) FILTER (WHERE c.target_date >= CURRENT_DATE AND c.target_date <= CURRENT_DATE + INTERVAL '7 days' AND c.status != 'Closed') as due_this_week,
          COUNT(*) FILTER (WHERE c.target_date > CURRENT_DATE + INTERVAL '7 days' AND c.status != 'Closed') as on_track,
          COUNT(*) FILTER (WHERE c.status = 'Closed') as closed
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE 1=1 ${projectFilter}
      `);

      // CAPA by package
      const byPackageResult = await db.query(`
        SELECT
          p.code as package_code,
          p.name as package_name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE c.status = 'Open') as open_count,
          COUNT(*) FILTER (WHERE c.status = 'In Progress') as in_progress,
          COUNT(*) FILTER (WHERE c.status = 'Closed') as closed
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE 1=1 ${projectFilter}
        GROUP BY p.id, p.code, p.name
        ORDER BY total DESC
      `);

      // Monthly trend (last 6 months)
      const trendResult = await db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', c.created_at), 'Mon') as month,
          DATE_TRUNC('month', c.created_at) as month_date,
          COUNT(*) as created,
          COUNT(*) FILTER (WHERE c.status = 'Closed') as closed
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE c.created_at >= NOW() - INTERVAL '6 months'
        ${projectFilter}
        GROUP BY DATE_TRUNC('month', c.created_at)
        ORDER BY month_date
      `);

      // Average closure time
      const closureTimeResult = await db.query(`
        SELECT
          AVG(EXTRACT(DAY FROM (c.closed_date - c.created_at::date))) as avg_closure_days
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE c.status = 'Closed'
        AND c.closed_date IS NOT NULL
        ${projectFilter}
      `);

      // Top overdue CAPAs
      const topOverdueResult = await db.query(`
        SELECT
          c.id,
          c.capa_number,
          c.finding_description,
          c.target_date,
          c.status,
          p.code as package_code,
          CURRENT_DATE - c.target_date as days_overdue
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE c.target_date < CURRENT_DATE
        AND c.status != 'Closed'
        ${projectFilter}
        ORDER BY days_overdue DESC
        LIMIT 10
      `);

      // Build status object
      const statusBreakdown: Record<string, number> = { Open: 0, 'In Progress': 0, Closed: 0 };
      statusResult.rows.forEach((row) => {
        statusBreakdown[row.status] = parseInt(row.count);
      });

      const overdueData = overdueResult.rows[0];

      res.json({
        success: true,
        data: {
          statusBreakdown,
          overdueAnalysis: {
            overdue: parseInt(overdueData?.overdue || 0),
            dueThisWeek: parseInt(overdueData?.due_this_week || 0),
            onTrack: parseInt(overdueData?.on_track || 0),
            closed: parseInt(overdueData?.closed || 0),
          },
          byPackage: byPackageResult.rows.map((row) => ({
            packageCode: row.package_code,
            packageName: row.package_name,
            total: parseInt(row.total),
            open: parseInt(row.open_count),
            inProgress: parseInt(row.in_progress),
            closed: parseInt(row.closed),
          })),
          monthlyTrend: trendResult.rows.map((row) => ({
            month: row.month,
            created: parseInt(row.created),
            closed: parseInt(row.closed),
          })),
          avgClosureDays: parseFloat(closureTimeResult.rows[0]?.avg_closure_days || 0).toFixed(1),
          topOverdue: topOverdueResult.rows.map((row) => ({
            id: row.id,
            capaNumber: row.capa_number,
            finding: row.finding_description?.substring(0, 100) + (row.finding_description?.length > 100 ? '...' : ''),
            targetDate: row.target_date,
            status: row.status,
            packageCode: row.package_code,
            daysOverdue: parseInt(row.days_overdue),
          })),
        },
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
        `SELECT c.capa_number, c.finding_description, a.auditor_id, a.package_id
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

      // Notify the auditor that CAPA was verified (in-app + email)
      if (capaResult.rows.length > 0) {
        const { capa_number, finding_description, auditor_id, package_id } = capaResult.rows[0];

        // Send email to package managers
        const managers = await getPackageManagersWithEmail(package_id);
        for (const manager of managers) {
          await emailService.sendCapaCompleted(manager.email, {
            capaNumber: capa_number,
            finding: finding_description?.substring(0, 200) + (finding_description?.length > 200 ? '...' : ''),
            completedBy: req.user?.name || 'Verifier',
            completedDate: format(new Date(), 'PPP'),
            link: `${APP_URL}/capa?id=${id}`,
          });
        }

        // In-app notification to auditor
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

          // Send email to auditor
          const auditorInfo = await getUserEmail(auditor_id);
          if (auditorInfo) {
            await emailService.sendCapaCompleted(auditorInfo.email, {
              capaNumber: capa_number,
              finding: finding_description?.substring(0, 200) + (finding_description?.length > 200 ? '...' : ''),
              completedBy: req.user?.name || 'Verifier',
              completedDate: format(new Date(), 'PPP'),
              link: `${APP_URL}/capa?id=${id}`,
            });
          }
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
