import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export class PackageController {
  getAllPackages = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        'SELECT * FROM packages WHERE status = $1 ORDER BY code',
        ['Active']
      );

      res.json({
        success: true,
        data: result.rows.map((pkg) => ({
          id: pkg.id,
          code: pkg.code,
          name: pkg.name,
          location: pkg.location,
          description: pkg.description,
          contractorName: pkg.contractor_name,
          status: pkg.status,
          createdAt: pkg.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  getPackageById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query('SELECT * FROM packages WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        throw new AppError('Package not found', 404);
      }

      const pkg = result.rows[0];

      res.json({
        success: true,
        data: {
          id: pkg.id,
          code: pkg.code,
          name: pkg.name,
          location: pkg.location,
          description: pkg.description,
          contractorName: pkg.contractor_name,
          status: pkg.status,
          createdAt: pkg.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getPackageAudits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT a.*, u.name as auditor_name
         FROM audits a
         LEFT JOIN users u ON a.auditor_id = u.id
         WHERE a.package_id = $1
         ORDER BY a.created_at DESC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows.map((audit) => ({
          id: audit.id,
          auditNumber: audit.audit_number,
          auditType: audit.audit_type,
          auditorName: audit.auditor_name,
          status: audit.status,
          compliancePercentage: audit.compliance_percentage,
          createdAt: audit.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  getPackageKPIs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { periodMonth, periodYear } = req.query;

      let query = `
        SELECT ke.*, ki.name as indicator_name, ki.type, ki.unit, ki.benchmark_value
        FROM kpi_entries ke
        JOIN kpi_indicators ki ON ke.indicator_id = ki.id
        WHERE ke.package_id = $1
      `;
      const params: any[] = [id];
      let paramIndex = 2;

      if (periodMonth) {
        query += ` AND ke.period_month = $${paramIndex++}`;
        params.push(periodMonth);
      }

      if (periodYear) {
        query += ` AND ke.period_year = $${paramIndex++}`;
        params.push(periodYear);
      }

      query += ' ORDER BY ke.period_year DESC, ke.period_month DESC, ki.display_order';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((entry) => ({
          id: entry.id,
          indicatorId: entry.indicator_id,
          indicatorName: entry.indicator_name,
          type: entry.type,
          unit: entry.unit,
          benchmarkValue: entry.benchmark_value,
          periodMonth: entry.period_month,
          periodYear: entry.period_year,
          targetValue: entry.target_value,
          actualValue: entry.actual_value,
          manHoursWorked: entry.man_hours_worked,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  createPackage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { code, name, location, description, contractorName } = req.body;

      const result = await db.query(
        `INSERT INTO packages (code, name, location, description, contractor_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [code, name, location || null, description || null, contractorName || null]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  };

  updatePackage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, location, description, contractorName, status } = req.body;

      await db.query(
        `UPDATE packages SET
         name = COALESCE($1, name),
         location = COALESCE($2, location),
         description = COALESCE($3, description),
         contractor_name = COALESCE($4, contractor_name),
         status = COALESCE($5, status)
         WHERE id = $6`,
        [name, location, description, contractorName, status, id]
      );

      res.json({
        success: true,
        message: 'Package updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
