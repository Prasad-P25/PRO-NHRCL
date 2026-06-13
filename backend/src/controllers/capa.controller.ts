import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createNotification, getPackageManagers, getPackageManagersWithEmail, getUserEmail } from './notification.controller';
import { emailService } from '../services/email.service';
import { generateCapaNumber, withUniqueRetry } from './audit.controller';
import { format } from 'date-fns';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Verify the CAPA exists and belongs to the caller's project (IDOR protection).
 * Super Admin may access CAPAs in any project. Returns the CAPA row.
 */
const assertCAPAAccess = async (capaId: string | number, req: AuthRequest) => {
  const result = await db.query(
    `SELECT c.id, c.status, c.corrective_action, p.project_id
     FROM capa c
     JOIN audit_responses ar ON c.response_id = ar.id
     JOIN audits a ON ar.audit_id = a.id
     JOIN packages p ON a.package_id = p.id
     WHERE c.id = $1`,
    [capaId]
  );
  if (result.rows.length === 0) {
    throw new AppError('CAPA not found', 404);
  }
  if (req.user!.roleName !== 'Super Admin' && result.rows[0].project_id !== req.projectId) {
    throw new AppError('Access denied to this CAPA', 403);
  }
  return result.rows[0];
};

export class CAPAController {
  getAllCAPA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, packageId } = req.query;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
      const offset = (page - 1) * pageSize;
      const projectId = req.projectId;

      const fromAndWhere = `
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audit_items ai ON ar.audit_item_id = ai.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE 1=1
      `;

      const filters: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (projectId) {
        filters.push(`p.project_id = $${paramIndex++}`);
        params.push(projectId);
      }
      if (status) {
        filters.push(`c.status = $${paramIndex++}`);
        params.push(status);
      }
      if (packageId) {
        filters.push(`a.package_id = $${paramIndex++}`);
        params.push(packageId);
      }
      // Package Managers / lower roles can only see their own package
      if (req.user!.roleName !== 'Super Admin' && req.user!.roleName !== 'PMC Head' && req.user!.packageId) {
        filters.push(`a.package_id = $${paramIndex++}`);
        params.push(req.user!.packageId);
      }

      const whereClause = filters.length ? ' AND ' + filters.join(' AND ') : '';

      // Explicit count query (no fragile string replacement)
      const countResult = await db.query(
        `SELECT COUNT(*) ${fromAndWhere} ${whereClause}`,
        params
      );

      const query = `
        SELECT c.*, ar.status as response_status, ai.audit_point,
               a.audit_number, p.code as package_code, p.name as package_name
        ${fromAndWhere} ${whereClause}
        ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      params.push(pageSize, offset);

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
        page,
        pageSize,
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / pageSize),
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

      // Verify the response exists and belongs to the caller's project (IDOR)
      const responseCheck = await db.query(
        `SELECT p.project_id
         FROM audit_responses ar
         JOIN audits a ON ar.audit_id = a.id
         JOIN packages p ON a.package_id = p.id
         WHERE ar.id = $1`,
        [responseId]
      );
      if (responseCheck.rows.length === 0) {
        throw new AppError('Audit response not found', 404);
      }
      if (req.user!.roleName !== 'Super Admin' && responseCheck.rows[0].project_id !== req.projectId) {
        throw new AppError('Access denied to this audit response', 403);
      }

      // Race-safe CAPA number generation (retries on unique-violation)
      const { capaNumber, result } = await withUniqueRetry(async () => {
        const capaNumber = await generateCapaNumber(db);
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
        return { capaNumber, result };
      });

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

        // Notify package managers (in-app + email) - run in parallel to prevent timeout
        const managers = await getPackageManagersWithEmail(package_id);

        // Create all notifications in parallel
        const notificationPromises = managers.map(manager =>
          createNotification(
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
          ).catch(err => console.error('Failed to create notification:', err))
        );

        // Send all emails in parallel (non-blocking)
        const emailPromises = managers.map(manager =>
          emailService.sendCapaCreated(manager.email, {
            capaNumber,
            auditNumber: audit_number,
            finding: findingDescription.substring(0, 200) + (findingDescription.length > 200 ? '...' : ''),
            assigneeName: manager.name,
            dueDate: targetDate ? format(new Date(targetDate), 'PPP') : 'Not set',
            link: `${APP_URL}/capa?id=${result.rows[0].id}`,
          }).catch(err => console.error('Failed to send CAPA email:', err))
        );

        // Wait for notifications but don't block on emails
        await Promise.all(notificationPromises);
        // Fire-and-forget emails to prevent timeout
        Promise.all(emailPromises).catch(() => {});
      }

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  };

  getCAPAById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await assertCAPAAccess(id, req);

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

      const capa = await assertCAPAAccess(id, req);

      // Whitelist status transitions. Closing must go through closeCAPA (which
      // records verifier + closed_date), so it cannot be set via a plain update.
      if (status !== undefined && status !== null) {
        if (status === 'Closed') {
          throw new AppError('Use the close endpoint to close a CAPA', 400);
        }
        if (!['Open', 'In Progress'].includes(status)) {
          throw new AppError('Invalid CAPA status', 400);
        }
        if (capa.status === 'Closed') {
          throw new AppError('A closed CAPA cannot be reopened via update', 409);
        }
      }

      await db.query(
        `UPDATE capa SET
         root_cause = COALESCE($1, root_cause),
         corrective_action = COALESCE($2, corrective_action),
         preventive_action = COALESCE($3, preventive_action),
         responsible_person = COALESCE($4, responsible_person),
         responsible_dept = COALESCE($5, responsible_dept),
         target_date = COALESCE($6, target_date),
         status = COALESCE($7, status),
         updated_at = CURRENT_TIMESTAMP
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

      // Build a parameterized filter shared by every analytics query.
      const filters: string[] = [];
      const filterParams: any[] = [];
      let idx = 1;
      if (projectId) {
        filters.push(`p.project_id = $${idx++}`);
        filterParams.push(projectId);
      }
      if (req.user!.roleName !== 'Super Admin' && req.user!.roleName !== 'PMC Head' && req.user!.packageId) {
        filters.push(`a.package_id = $${idx++}`);
        filterParams.push(req.user!.packageId);
      }
      const projectFilter = filters.length ? 'AND ' + filters.join(' AND ') : '';

      // Status breakdown
      const statusResult = await db.query(`
        SELECT c.status, COUNT(*) as count
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE 1=1 ${projectFilter}
        GROUP BY c.status
      `, filterParams);

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
      `, filterParams);

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
      `, filterParams);

      // Monthly trend (last 6 months): "created" counts by created_at month,
      // "closed" counts ACTUAL closures by closed_date month (not currently-closed
      // rows bucketed by creation date).
      const trendResult = await db.query(`
        WITH months AS (
          SELECT DATE_TRUNC('month', generate_series(
            DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
            DATE_TRUNC('month', NOW()),
            INTERVAL '1 month'
          )) AS month
        )
        SELECT
          TO_CHAR(m.month, 'Mon') as month,
          m.month as month_date,
          (SELECT COUNT(*) FROM capa c
             JOIN audit_responses ar ON c.response_id = ar.id
             JOIN audits a ON ar.audit_id = a.id
             JOIN packages p ON a.package_id = p.id
             WHERE DATE_TRUNC('month', c.created_at) = m.month ${projectFilter}) as created,
          (SELECT COUNT(*) FROM capa c
             JOIN audit_responses ar ON c.response_id = ar.id
             JOIN audits a ON ar.audit_id = a.id
             JOIN packages p ON a.package_id = p.id
             WHERE c.closed_date IS NOT NULL
               AND DATE_TRUNC('month', c.closed_date) = m.month ${projectFilter}) as closed
        FROM months m
        ORDER BY m.month
      `, filterParams);

      // Average closure time
      const closureTimeResult = await db.query(`
        SELECT
          AVG(c.closed_date::date - c.created_at::date) as avg_closure_days
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE c.status = 'Closed'
        AND c.closed_date IS NOT NULL
        ${projectFilter}
      `, filterParams);

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
      `, filterParams);

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

      // Verify existence + project access; reject if already closed or has no
      // corrective action recorded.
      const access = await assertCAPAAccess(id, req);
      if (access.status === 'Closed') {
        throw new AppError('CAPA is already closed', 409);
      }
      if (!access.corrective_action || access.corrective_action.trim() === '') {
        throw new AppError('A corrective action must be recorded before closing the CAPA', 400);
      }

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
         verification_remarks = $2,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [req.user!.id, verificationRemarks || null, id]
      );

      // Notify the auditor that CAPA was verified (in-app + email) - non-blocking
      if (capaResult.rows.length > 0) {
        const { capa_number, finding_description, auditor_id, package_id } = capaResult.rows[0];

        // Send emails to package managers in parallel (non-blocking)
        getPackageManagersWithEmail(package_id).then(managers => {
          const emailPromises = managers.map(manager =>
            emailService.sendCapaCompleted(manager.email, {
              capaNumber: capa_number,
              finding: finding_description?.substring(0, 200) + (finding_description?.length > 200 ? '...' : ''),
              completedBy: req.user?.name || 'Verifier',
              completedDate: format(new Date(), 'PPP'),
              link: `${APP_URL}/capa?id=${id}`,
            }).catch(err => console.error('Failed to send CAPA completed email:', err))
          );
          return Promise.all(emailPromises);
        }).catch(err => console.error('Failed to get managers for email:', err));

        // In-app notification to auditor (non-blocking)
        if (auditor_id && auditor_id !== req.user!.id) {
          createNotification(
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
          ).catch(err => console.error('Failed to create notification:', err));

          // Send email to auditor (non-blocking)
          getUserEmail(auditor_id).then(auditorInfo => {
            if (auditorInfo) {
              emailService.sendCapaCompleted(auditorInfo.email, {
                capaNumber: capa_number,
                finding: finding_description?.substring(0, 200) + (finding_description?.length > 200 ? '...' : ''),
                completedBy: req.user?.name || 'Verifier',
                completedDate: format(new Date(), 'PPP'),
                link: `${APP_URL}/capa?id=${id}`,
              }).catch(err => console.error('Failed to send auditor email:', err));
            }
          }).catch(err => console.error('Failed to get auditor email:', err));
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
