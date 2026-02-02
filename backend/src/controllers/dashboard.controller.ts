import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

export class DashboardController {
  getOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Overall compliance
      const complianceResult = await db.query(
        `SELECT
           COALESCE(AVG(compliance_percentage), 0) as avg_compliance,
           COUNT(*) FILTER (WHERE status = 'Approved') as approved_audits
         FROM audits
         WHERE status IN ('Approved', 'Closed')
         AND created_at >= NOW() - INTERVAL '30 days'`
      );

      // Previous month compliance for comparison
      const prevComplianceResult = await db.query(
        `SELECT COALESCE(AVG(compliance_percentage), 0) as avg_compliance
         FROM audits
         WHERE status IN ('Approved', 'Closed')
         AND created_at >= NOW() - INTERVAL '60 days'
         AND created_at < NOW() - INTERVAL '30 days'`
      );

      // Open NCs
      const ncResult = await db.query(
        `SELECT COUNT(*) as open_ncs
         FROM audit_responses ar
         JOIN audits a ON ar.audit_id = a.id
         WHERE ar.status = 'NC'
         AND a.status IN ('Approved', 'In Progress', 'Pending Review')`
      );

      // Previous month NCs
      const prevNcResult = await db.query(
        `SELECT COUNT(*) as open_ncs
         FROM audit_responses ar
         JOIN audits a ON ar.audit_id = a.id
         WHERE ar.status = 'NC'
         AND a.created_at >= NOW() - INTERVAL '60 days'
         AND a.created_at < NOW() - INTERVAL '30 days'`
      );

      // CAPA status breakdown
      const capaStatusResult = await db.query(
        `SELECT status, COUNT(*) as count
         FROM capa
         GROUP BY status`
      );

      // CAPA overdue
      const capaOverdueResult = await db.query(
        `SELECT COUNT(*) as overdue
         FROM capa
         WHERE status NOT IN ('Closed')
         AND target_date < CURRENT_DATE`
      );

      // Days without LTI (placeholder - would come from KPI entries)
      const ltiResult = await db.query(
        `SELECT COALESCE(MAX(actual_value), 0) as days_without_lti
         FROM kpi_entries ke
         JOIN kpi_indicators ki ON ke.indicator_id = ki.id
         WHERE ki.name LIKE '%Days Without LTI%'`
      );

      // Package compliance with more details
      const packageComplianceResult = await db.query(
        `SELECT p.id, p.code, p.name,
                COALESCE(AVG(a.compliance_percentage), 0) as compliance,
                COUNT(a.id) as audit_count,
                COALESCE(SUM(a.non_compliant_count), 0) as total_ncs
         FROM packages p
         LEFT JOIN audits a ON p.id = a.package_id AND a.status IN ('Approved', 'Closed')
         WHERE p.status = 'Active'
         GROUP BY p.id, p.code, p.name
         ORDER BY p.code`
      );

      // Compliance trend (last 6 months)
      const trendResult = await db.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
           DATE_TRUNC('month', created_at) as month_date,
           COALESCE(AVG(compliance_percentage), 0) as compliance,
           COUNT(*) as audit_count
         FROM audits
         WHERE status IN ('Approved', 'Closed')
         AND created_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at)`
      );

      // NC breakdown by category
      const ncByCategoryResult = await db.query(
        `SELECT c.code, c.name, COUNT(*) as count
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audit_sections s ON ai.section_id = s.id
         JOIN audit_categories c ON s.category_id = c.id
         JOIN audits a ON ar.audit_id = a.id
         WHERE ar.status = 'NC'
         AND a.status IN ('Approved', 'In Progress', 'Pending Review')
         GROUP BY c.id, c.code, c.name
         ORDER BY count DESC
         LIMIT 10`
      );

      // Recent audits
      const recentAuditsResult = await db.query(
        `SELECT a.*, p.code as package_code, p.name as package_name, u.name as auditor_name
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         LEFT JOIN users u ON a.auditor_id = u.id
         ORDER BY a.created_at DESC
         LIMIT 5`
      );

      // Recent activity (last 10 activities)
      const recentActivityResult = await db.query(
        `(SELECT 'audit' as type, a.audit_number as reference, a.status,
                 p.code as package_code, u.name as user_name, a.created_at as timestamp
          FROM audits a
          JOIN packages p ON a.package_id = p.id
          LEFT JOIN users u ON a.auditor_id = u.id
          ORDER BY a.created_at DESC
          LIMIT 5)
         UNION ALL
         (SELECT 'capa' as type, c.capa_number as reference, c.status,
                 p.code as package_code, NULL as user_name, c.created_at as timestamp
          FROM capa c
          JOIN audit_responses ar ON c.response_id = ar.id
          JOIN audits a ON ar.audit_id = a.id
          JOIN packages p ON a.package_id = p.id
          ORDER BY c.created_at DESC
          LIMIT 5)
         ORDER BY timestamp DESC
         LIMIT 10`
      );

      // Audit status distribution
      const auditStatusResult = await db.query(
        `SELECT status, COUNT(*) as count
         FROM audits
         GROUP BY status`
      );

      // Calculate compliance change
      const currentCompliance = parseFloat(complianceResult.rows[0]?.avg_compliance || 0);
      const prevCompliance = parseFloat(prevComplianceResult.rows[0]?.avg_compliance || 0);
      const complianceChange = prevCompliance > 0 ?
        parseFloat((currentCompliance - prevCompliance).toFixed(1)) : 0;

      // Calculate NC change
      const currentNCs = parseInt(ncResult.rows[0]?.open_ncs || 0);
      const prevNCs = parseInt(prevNcResult.rows[0]?.open_ncs || 0);
      const ncChange = currentNCs - prevNCs;

      // Build CAPA status object
      const capaStatus: Record<string, number> = { Open: 0, 'In Progress': 0, Closed: 0 };
      capaStatusResult.rows.forEach((row) => {
        capaStatus[row.status] = parseInt(row.count);
      });

      // Build audit status object
      const auditStatus: Record<string, number> = {};
      auditStatusResult.rows.forEach((row) => {
        auditStatus[row.status] = parseInt(row.count);
      });

      res.json({
        success: true,
        data: {
          stats: {
            overallCompliance: currentCompliance.toFixed(1),
            openNCs: currentNCs,
            capaOverdue: parseInt(capaOverdueResult.rows[0]?.overdue || 0),
            daysWithoutLTI: parseInt(ltiResult.rows[0]?.days_without_lti || 0),
            complianceChange,
            ncChange,
            totalAudits: auditStatusResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
            totalCAPAs: capaStatusResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
          },
          capaStatus,
          auditStatus,
          packageCompliance: packageComplianceResult.rows.map((row) => ({
            packageId: row.id,
            packageCode: row.code,
            packageName: row.name,
            compliancePercentage: parseFloat(row.compliance).toFixed(1),
            auditCount: parseInt(row.audit_count),
            totalNCs: parseInt(row.total_ncs),
          })),
          complianceTrend: trendResult.rows.map((row) => ({
            month: row.month,
            compliance: parseFloat(row.compliance).toFixed(1),
            auditCount: parseInt(row.audit_count),
          })),
          ncByCategory: ncByCategoryResult.rows.map((row) => ({
            code: row.code,
            name: row.name,
            count: parseInt(row.count),
          })),
          recentAudits: recentAuditsResult.rows.map((audit) => ({
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
            auditor: audit.auditor_id ? { name: audit.auditor_name } : null,
            status: audit.status,
            totalItems: audit.total_items,
            compliantCount: audit.compliant_count,
            nonCompliantCount: audit.non_compliant_count,
            naCount: audit.na_count,
            compliancePercentage: audit.compliance_percentage,
            createdAt: audit.created_at,
          })),
          recentActivity: recentActivityResult.rows.map((activity) => ({
            type: activity.type,
            reference: activity.reference,
            status: activity.status,
            packageCode: activity.package_code,
            userName: activity.user_name,
            timestamp: activity.timestamp,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getPackageDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Similar to overview but filtered by package
      const complianceResult = await db.query(
        `SELECT
           COALESCE(AVG(compliance_percentage), 0) as avg_compliance
         FROM audits
         WHERE package_id = $1
         AND status IN ('Approved', 'Closed')`,
        [id]
      );

      res.json({
        success: true,
        data: {
          stats: {
            overallCompliance: parseFloat(complianceResult.rows[0]?.avg_compliance || 0).toFixed(1),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getKPISummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, periodMonth, periodYear } = req.query;

      const currentMonth = periodMonth || new Date().getMonth() + 1;
      const currentYear = periodYear || new Date().getFullYear();

      let leadingQuery = `
        SELECT ki.name, ki.unit, ki.benchmark_value,
               COALESCE(ke.target_value, ki.benchmark_value) as target,
               ke.actual_value as actual
        FROM kpi_indicators ki
        LEFT JOIN kpi_entries ke ON ki.id = ke.indicator_id
             AND ke.period_month = $1 AND ke.period_year = $2
        WHERE ki.type = 'Leading'
      `;
      const params: any[] = [currentMonth, currentYear];

      if (packageId) {
        leadingQuery += ` AND (ke.package_id = $3 OR ke.package_id IS NULL)`;
        params.push(packageId);
      }

      leadingQuery += ' ORDER BY ki.display_order';

      const leadingResult = await db.query(leadingQuery, params);

      // Similar for lagging indicators
      const laggingResult = await db.query(
        `SELECT ki.name, ki.unit, ki.benchmark_value,
                ke.actual_value as value
         FROM kpi_indicators ki
         LEFT JOIN kpi_entries ke ON ki.id = ke.indicator_id
              AND ke.period_month = $1 AND ke.period_year = $2
         WHERE ki.type = 'Lagging'
         ORDER BY ki.display_order`,
        [currentMonth, currentYear]
      );

      res.json({
        success: true,
        data: {
          leadingIndicators: leadingResult.rows.map((row) => ({
            name: row.name,
            target: row.target,
            actual: row.actual,
            unit: row.unit,
          })),
          laggingIndicators: laggingResult.rows.map((row) => ({
            name: row.name,
            value: row.value,
            benchmark: row.benchmark_value,
            unit: row.unit,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
