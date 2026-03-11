import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

export class ReportController {
  getComplianceSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, startDate, endDate } = req.query;
      const projectId = req.projectId;

      let query = `
        SELECT p.code, p.name,
               COUNT(a.id) as total_audits,
               AVG(a.compliance_percentage) as avg_compliance,
               SUM(a.compliant_count) as total_compliant,
               SUM(a.non_compliant_count) as total_nc,
               SUM(a.na_count) as total_na
        FROM packages p
        LEFT JOIN audits a ON p.id = a.package_id AND a.status IN ('Approved', 'Closed')
        WHERE p.status = 'Active'
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Project filter
      if (projectId) {
        query += ` AND p.project_id = $${paramIndex++}`;
        params.push(projectId);
      }

      if (packageId) {
        query += ` AND p.id = $${paramIndex++}`;
        params.push(packageId);
      }

      if (startDate) {
        query += ` AND a.created_at >= $${paramIndex++}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND a.created_at <= $${paramIndex++}`;
        params.push(endDate);
      }

      query += ' GROUP BY p.id, p.code, p.name ORDER BY p.code';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          packageCode: row.code,
          packageName: row.name,
          totalAudits: parseInt(row.total_audits),
          avgCompliance: parseFloat(row.avg_compliance || 0).toFixed(1),
          totalCompliant: parseInt(row.total_compliant || 0),
          totalNC: parseInt(row.total_nc || 0),
          totalNA: parseInt(row.total_na || 0),
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  getNCsSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, categoryId, riskRating } = req.query;
      const projectId = req.projectId;

      let query = `
        SELECT ar.*, ai.audit_point, ai.standard_reference, ai.priority,
               s.name as section_name, c.name as category_name, c.code as category_code,
               a.audit_number, p.code as package_code, p.name as package_name
        FROM audit_responses ar
        JOIN audit_items ai ON ar.audit_item_id = ai.id
        JOIN audit_sections s ON ai.section_id = s.id
        JOIN audit_categories c ON s.category_id = c.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE ar.status = 'NC'
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Project filter
      if (projectId) {
        query += ` AND p.project_id = $${paramIndex++}`;
        params.push(projectId);
      }

      if (packageId) {
        query += ` AND a.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      if (categoryId) {
        query += ` AND c.id = $${paramIndex++}`;
        params.push(categoryId);
      }

      if (riskRating) {
        query += ` AND ar.risk_rating = $${paramIndex++}`;
        params.push(riskRating);
      }

      query += ' ORDER BY a.created_at DESC, c.display_order, ai.sr_no';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          id: row.id,
          auditNumber: row.audit_number,
          packageCode: row.package_code,
          packageName: row.package_name,
          categoryCode: row.category_code,
          categoryName: row.category_name,
          sectionName: row.section_name,
          auditPoint: row.audit_point,
          standardReference: row.standard_reference,
          priority: row.priority,
          observation: row.observation,
          riskRating: row.risk_rating,
          capaRequired: row.capa_required,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  getCAPAStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId } = req.query;
      const projectId = req.projectId;

      let query = `
        SELECT c.status, COUNT(*) as count
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
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

      if (packageId) {
        query += ` AND a.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      query += ' GROUP BY c.status';

      const result = await db.query(query, params);

      // Overdue count
      let overdueQuery = `
        SELECT COUNT(*) as overdue
        FROM capa c
        JOIN audit_responses ar ON c.response_id = ar.id
        JOIN audits a ON ar.audit_id = a.id
        JOIN packages p ON a.package_id = p.id
        WHERE c.status NOT IN ('Closed') AND c.target_date < CURRENT_DATE
      `;
      const overdueParams: any[] = [];
      let overdueParamIndex = 1;

      if (projectId) {
        overdueQuery += ` AND p.project_id = $${overdueParamIndex++}`;
        overdueParams.push(projectId);
      }

      if (packageId) {
        overdueQuery += ` AND a.package_id = $${overdueParamIndex++}`;
        overdueParams.push(packageId);
      }

      const overdueResult = await db.query(overdueQuery, overdueParams);

      res.json({
        success: true,
        data: {
          statusCounts: result.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
          }, {} as Record<string, number>),
          overdue: parseInt(overdueResult.rows[0].overdue),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getTrendAnalysis = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, months = 12 } = req.query;
      const projectId = req.projectId;

      let query = `
        SELECT
          DATE_TRUNC('month', a.created_at) as month,
          AVG(a.compliance_percentage) as avg_compliance,
          SUM(a.non_compliant_count) as total_ncs,
          COUNT(a.id) as audit_count
        FROM audits a
        ${projectId ? 'JOIN packages p ON a.package_id = p.id' : ''}
        WHERE a.status IN ('Approved', 'Closed')
        AND a.created_at >= NOW() - INTERVAL '${months} months'
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Project filter
      if (projectId) {
        query += ` AND p.project_id = $${paramIndex++}`;
        params.push(projectId);
      }

      if (packageId) {
        query += ` AND a.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      query += ' GROUP BY DATE_TRUNC(\'month\', a.created_at) ORDER BY month';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          month: row.month,
          avgCompliance: parseFloat(row.avg_compliance || 0).toFixed(1),
          totalNCs: parseInt(row.total_ncs || 0),
          auditCount: parseInt(row.audit_count),
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  getPackageComparison = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = req.projectId;

      const result = await db.query(
        `SELECT p.id, p.code, p.name,
                COUNT(a.id) as total_audits,
                AVG(a.compliance_percentage) as avg_compliance,
                SUM(a.non_compliant_count) as total_ncs,
                COUNT(c.id) as open_capas
         FROM packages p
         LEFT JOIN audits a ON p.id = a.package_id AND a.status IN ('Approved', 'Closed')
         LEFT JOIN audit_responses ar ON a.id = ar.audit_id AND ar.status = 'NC'
         LEFT JOIN capa c ON ar.id = c.response_id AND c.status != 'Closed'
         WHERE p.status = 'Active'
         ${projectId ? `AND p.project_id = ${projectId}` : ''}
         GROUP BY p.id, p.code, p.name
         ORDER BY p.code`
      );

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          packageId: row.id,
          packageCode: row.code,
          packageName: row.name,
          totalAudits: parseInt(row.total_audits || 0),
          avgCompliance: parseFloat(row.avg_compliance || 0).toFixed(1),
          totalNCs: parseInt(row.total_ncs || 0),
          openCAPAs: parseInt(row.open_capas || 0),
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reportType, format, ...filters } = req.body;

      // In a real implementation, this would generate PDF/Excel
      res.json({
        success: true,
        message: 'Export functionality to be implemented',
        data: {
          reportType,
          format,
          filters,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
