import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

export class DashboardController {
  getOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = req.projectId;

      // Helper: build "[JOIN packages] ... AND p.project_id = $1" pieces, parameterized.
      const pkgJoin = projectId ? 'JOIN packages p ON a.package_id = p.id' : '';
      const pkgWhere = projectId ? 'AND p.project_id = $1' : '';
      const pidParam: any[] = projectId ? [projectId] : [];

      // Overall compliance (last 30 days)
      const complianceResult = await db.query(
        `SELECT
           COALESCE(AVG(a.compliance_percentage), 0) as avg_compliance,
           COUNT(*) FILTER (WHERE a.status = 'Approved') as approved_audits
         FROM audits a
         ${pkgJoin}
         WHERE a.status IN ('Approved', 'Closed')
         AND a.created_at >= NOW() - INTERVAL '30 days'
         ${pkgWhere}`,
        pidParam
      );

      // Previous month compliance for comparison (30-60 days)
      const prevComplianceResult = await db.query(
        `SELECT COALESCE(AVG(a.compliance_percentage), 0) as avg_compliance
         FROM audits a
         ${pkgJoin}
         WHERE a.status IN ('Approved', 'Closed')
         AND a.created_at >= NOW() - INTERVAL '60 days'
         AND a.created_at < NOW() - INTERVAL '30 days'
         ${pkgWhere}`,
        pidParam
      );

      // Open NCs (all-time, for the displayed stat)
      const ncResult = await db.query(
        `SELECT COUNT(*) as open_ncs
         FROM audit_responses ar
         JOIN audits a ON ar.audit_id = a.id
         ${pkgJoin}
         WHERE ar.status = 'NC'
         AND a.status IN ('Approved', 'In Progress', 'Pending Review')
         ${pkgWhere}`,
        pidParam
      );

      // NC change: compare two equal windows with IDENTICAL predicates so the
      // trend arrow is meaningful (new NCs this period vs last period).
      const ncThisPeriodResult = await db.query(
        `SELECT COUNT(*) as ncs
         FROM audit_responses ar
         JOIN audits a ON ar.audit_id = a.id
         ${pkgJoin}
         WHERE ar.status = 'NC'
         AND a.status IN ('Approved', 'In Progress', 'Pending Review')
         AND a.created_at >= NOW() - INTERVAL '30 days'
         ${pkgWhere}`,
        pidParam
      );
      const ncPrevPeriodResult = await db.query(
        `SELECT COUNT(*) as ncs
         FROM audit_responses ar
         JOIN audits a ON ar.audit_id = a.id
         ${pkgJoin}
         WHERE ar.status = 'NC'
         AND a.status IN ('Approved', 'In Progress', 'Pending Review')
         AND a.created_at >= NOW() - INTERVAL '60 days'
         AND a.created_at < NOW() - INTERVAL '30 days'
         ${pkgWhere}`,
        pidParam
      );

      // CAPA status breakdown
      const capaStatusResult = await db.query(
        `SELECT c.status, COUNT(*) as count
         FROM capa c
         ${projectId ? `
         JOIN audit_responses ar ON c.response_id = ar.id
         JOIN audits a ON ar.audit_id = a.id
         JOIN packages p ON a.package_id = p.id
         WHERE p.project_id = $1
         ` : ''}
         GROUP BY c.status`,
        pidParam
      );

      // CAPA overdue
      const capaOverdueResult = await db.query(
        `SELECT COUNT(*) as overdue
         FROM capa c
         ${projectId ? `
         JOIN audit_responses ar ON c.response_id = ar.id
         JOIN audits a ON ar.audit_id = a.id
         JOIN packages p ON a.package_id = p.id
         WHERE p.project_id = $1 AND
         ` : 'WHERE'}
         c.status NOT IN ('Closed')
         AND c.target_date < CURRENT_DATE`,
        pidParam
      );

      // Days without LTI: the most recent month's value (not MAX over all history)
      const ltiResult = await db.query(
        `SELECT ke.actual_value as days_without_lti
         FROM kpi_entries ke
         JOIN kpi_indicators ki ON ke.indicator_id = ki.id
         ${projectId ? 'JOIN packages p ON ke.package_id = p.id' : ''}
         WHERE ki.name LIKE '%Days Without LTI%'
         ${projectId ? 'AND p.project_id = $1' : ''}
         ORDER BY ke.period_year DESC, ke.period_month DESC
         LIMIT 1`,
        pidParam
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
         ${projectId ? 'AND p.project_id = $1' : ''}
         GROUP BY p.id, p.code, p.name
         ORDER BY p.code`,
        pidParam
      );

      // Compliance trend (last 6 months)
      const trendResult = await db.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', a.created_at), 'Mon') as month,
           DATE_TRUNC('month', a.created_at) as month_date,
           COALESCE(AVG(a.compliance_percentage), 0) as compliance,
           COUNT(*) as audit_count
         FROM audits a
         ${pkgJoin}
         WHERE a.status IN ('Approved', 'Closed')
         AND a.created_at >= NOW() - INTERVAL '6 months'
         ${pkgWhere}
         GROUP BY DATE_TRUNC('month', a.created_at)
         ORDER BY DATE_TRUNC('month', a.created_at)`,
        pidParam
      );

      // NC breakdown by category
      const ncByCategoryResult = await db.query(
        `SELECT c.code, c.name, COUNT(*) as count
         FROM audit_responses ar
         JOIN audit_items ai ON ar.audit_item_id = ai.id
         JOIN audit_sections s ON ai.section_id = s.id
         JOIN audit_categories c ON s.category_id = c.id
         JOIN audits a ON ar.audit_id = a.id
         ${pkgJoin}
         WHERE ar.status = 'NC'
         AND a.status IN ('Approved', 'In Progress', 'Pending Review')
         ${pkgWhere}
         GROUP BY c.id, c.code, c.name
         ORDER BY count DESC
         LIMIT 10`,
        pidParam
      );

      // Recent audits
      const recentAuditsResult = await db.query(
        `SELECT a.*, p.code as package_code, p.name as package_name, u.name as auditor_name
         FROM audits a
         JOIN packages p ON a.package_id = p.id
         LEFT JOIN users u ON a.auditor_id = u.id
         ${projectId ? 'WHERE p.project_id = $1' : ''}
         ORDER BY a.created_at DESC
         LIMIT 5`,
        pidParam
      );

      // Recent activity (last 10 activities)
      const recentActivityResult = await db.query(
        `(SELECT 'audit' as type, a.audit_number as reference, a.status,
                 p.code as package_code, u.name as user_name, a.created_at as timestamp
          FROM audits a
          JOIN packages p ON a.package_id = p.id
          LEFT JOIN users u ON a.auditor_id = u.id
          ${projectId ? 'WHERE p.project_id = $1' : ''}
          ORDER BY a.created_at DESC
          LIMIT 5)
         UNION ALL
         (SELECT 'capa' as type, c.capa_number as reference, c.status,
                 p.code as package_code, NULL as user_name, c.created_at as timestamp
          FROM capa c
          JOIN audit_responses ar ON c.response_id = ar.id
          JOIN audits a ON ar.audit_id = a.id
          JOIN packages p ON a.package_id = p.id
          ${projectId ? 'WHERE p.project_id = $1' : ''}
          ORDER BY c.created_at DESC
          LIMIT 5)
         ORDER BY timestamp DESC
         LIMIT 10`,
        pidParam
      );

      // Audit status distribution
      const auditStatusResult = await db.query(
        `SELECT a.status, COUNT(*) as count
         FROM audits a
         ${pkgJoin}
         ${projectId ? 'WHERE p.project_id = $1' : ''}
         GROUP BY a.status`,
        pidParam
      );

      // Calculate compliance change
      const currentCompliance = parseFloat(complianceResult.rows[0]?.avg_compliance || 0);
      const prevCompliance = parseFloat(prevComplianceResult.rows[0]?.avg_compliance || 0);
      const complianceChange = prevCompliance > 0 ?
        parseFloat((currentCompliance - prevCompliance).toFixed(1)) : 0;

      // Open NC stat (all-time) and a like-for-like period-over-period change
      const currentNCs = parseInt(ncResult.rows[0]?.open_ncs || 0);
      const ncThisPeriod = parseInt(ncThisPeriodResult.rows[0]?.ncs || 0);
      const ncPrevPeriod = parseInt(ncPrevPeriodResult.rows[0]?.ncs || 0);
      const ncChange = ncThisPeriod - ncPrevPeriod;

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

      // Compliance + audit/CAPA rollups for a single package
      const complianceResult = await db.query(
        `SELECT
           COALESCE(AVG(compliance_percentage), 0) as avg_compliance,
           COUNT(*) as total_audits,
           COUNT(*) FILTER (WHERE status = 'Approved') as approved_audits,
           COALESCE(SUM(non_compliant_count), 0) as total_ncs
         FROM audits
         WHERE package_id = $1
         AND status IN ('Approved', 'Closed')`,
        [id]
      );

      const capaResult = await db.query(
        `SELECT
           COUNT(*) as total_capas,
           COUNT(*) FILTER (WHERE c.status != 'Closed') as open_capas,
           COUNT(*) FILTER (WHERE c.status != 'Closed' AND c.target_date < CURRENT_DATE) as overdue_capas
         FROM capa c
         JOIN audit_responses ar ON c.response_id = ar.id
         JOIN audits a ON ar.audit_id = a.id
         WHERE a.package_id = $1`,
        [id]
      );

      const stats = complianceResult.rows[0] || {};
      const capaStats = capaResult.rows[0] || {};

      res.json({
        success: true,
        data: {
          stats: {
            overallCompliance: parseFloat(stats.avg_compliance || 0).toFixed(1),
            totalAudits: parseInt(stats.total_audits || 0),
            approvedAudits: parseInt(stats.approved_audits || 0),
            totalNCs: parseInt(stats.total_ncs || 0),
            totalCAPAs: parseInt(capaStats.total_capas || 0),
            openCAPAs: parseInt(capaStats.open_capas || 0),
            overdueCAPAs: parseInt(capaStats.overdue_capas || 0),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Project comparison dashboard
  getProjectComparison = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Aggregate audits and CAPAs per project in SEPARATE subqueries so the
      // LEFT JOIN chain does not fan out (which would inflate AVG/COUNT).
      const projectMetrics = await db.query(`
        SELECT
          pr.id,
          pr.code,
          pr.name,
          COALESCE(am.total_audits, 0) as total_audits,
          COALESCE(am.avg_compliance, 0) as avg_compliance,
          COALESCE(am.approved_audits, 0) as approved_audits,
          COALESCE(cm.total_capas, 0) as total_capas,
          COALESCE(cm.open_capas, 0) as open_capas,
          COALESCE(cm.overdue_capas, 0) as overdue_capas,
          COALESCE(pk.package_count, 0) as package_count
        FROM projects pr
        LEFT JOIN (
          SELECT p.project_id,
                 COUNT(a.id) as total_audits,
                 AVG(a.compliance_percentage) as avg_compliance,
                 COUNT(*) FILTER (WHERE a.status = 'Approved') as approved_audits
          FROM packages p
          JOIN audits a ON a.package_id = p.id AND a.status IN ('Approved', 'Closed')
          GROUP BY p.project_id
        ) am ON am.project_id = pr.id
        LEFT JOIN (
          SELECT p.project_id,
                 COUNT(c.id) as total_capas,
                 COUNT(*) FILTER (WHERE c.status IN ('Open', 'In Progress')) as open_capas,
                 COUNT(*) FILTER (WHERE c.target_date < CURRENT_DATE AND c.status != 'Closed') as overdue_capas
          FROM packages p
          JOIN audits a ON a.package_id = p.id
          JOIN audit_responses ar ON ar.audit_id = a.id
          JOIN capa c ON c.response_id = ar.id
          GROUP BY p.project_id
        ) cm ON cm.project_id = pr.id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as package_count
          FROM packages GROUP BY project_id
        ) pk ON pk.project_id = pr.id
        WHERE pr.status = 'Active'
        ORDER BY pr.name
      `);

      // Get monthly compliance trend for all projects (last 6 months)
      const complianceTrend = await db.query(`
        SELECT
          pr.code as project_code,
          TO_CHAR(DATE_TRUNC('month', a.created_at), 'Mon') as month,
          DATE_TRUNC('month', a.created_at) as month_date,
          COALESCE(AVG(a.compliance_percentage), 0) as compliance
        FROM projects pr
        JOIN packages p ON p.project_id = pr.id
        JOIN audits a ON a.package_id = p.id AND a.status IN ('Approved', 'Closed')
        WHERE a.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY pr.id, pr.code, DATE_TRUNC('month', a.created_at)
        ORDER BY pr.id, month_date
      `);

      // Group trend data by project
      const trendByProject: Record<string, any[]> = {};
      complianceTrend.rows.forEach((row) => {
        if (!trendByProject[row.project_code]) {
          trendByProject[row.project_code] = [];
        }
        trendByProject[row.project_code].push({
          month: row.month,
          compliance: parseFloat(row.compliance).toFixed(1),
        });
      });

      // Get NC breakdown by project
      const ncByProject = await db.query(`
        SELECT
          pr.code as project_code,
          pr.name as project_name,
          COUNT(*) as nc_count
        FROM projects pr
        JOIN packages p ON p.project_id = pr.id
        JOIN audits a ON a.package_id = p.id
        JOIN audit_responses ar ON ar.audit_id = a.id
        WHERE ar.status = 'NC'
        AND a.status IN ('Approved', 'In Progress', 'Pending Review')
        GROUP BY pr.id, pr.code, pr.name
        ORDER BY nc_count DESC
      `);

      res.json({
        success: true,
        data: {
          projects: projectMetrics.rows.map((row) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            totalAudits: parseInt(row.total_audits),
            avgCompliance: parseFloat(row.avg_compliance).toFixed(1),
            approvedAudits: parseInt(row.approved_audits),
            totalCapas: parseInt(row.total_capas),
            openCapas: parseInt(row.open_capas),
            overdueCapas: parseInt(row.overdue_capas),
            packageCount: parseInt(row.package_count),
          })),
          complianceTrend: trendByProject,
          ncByProject: ncByProject.rows.map((row) => ({
            code: row.project_code,
            name: row.project_name,
            count: parseInt(row.nc_count),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getKPISummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, periodMonth, periodYear } = req.query;
      const projectId = req.projectId;

      const currentMonth = periodMonth || new Date().getMonth() + 1;
      const currentYear = periodYear || new Date().getFullYear();

      // Build the entry-join predicates (project/package filters belong in the
      // JOIN ON clause so indicators with no matching entry still appear as NULL)
      // and AGGREGATE per indicator to avoid duplicate rows across packages.
      const buildQuery = (indicatorType: 'Leading' | 'Lagging') => {
        const params: any[] = [currentMonth, currentYear];
        let onClause = `ke.period_month = $1 AND ke.period_year = $2`;
        let paramIndex = 3;

        if (projectId) {
          onClause += ` AND ke.package_id IN (SELECT id FROM packages WHERE project_id = $${paramIndex++})`;
          params.push(projectId);
        }
        if (packageId) {
          onClause += ` AND ke.package_id = $${paramIndex++}`;
          params.push(packageId);
        }

        const query = `
          SELECT ki.name, ki.unit, ki.benchmark_value,
                 COALESCE(AVG(ke.target_value), ki.benchmark_value) as target,
                 AVG(ke.actual_value) as actual
          FROM kpi_indicators ki
          LEFT JOIN kpi_entries ke ON ki.id = ke.indicator_id AND ${onClause}
          WHERE ki.type = '${indicatorType}'
          GROUP BY ki.id, ki.name, ki.unit, ki.benchmark_value, ki.display_order
          ORDER BY ki.display_order
        `;
        return { query, params };
      };

      const leading = buildQuery('Leading');
      const lagging = buildQuery('Lagging');

      const leadingResult = await db.query(leading.query, leading.params);
      const laggingResult = await db.query(lagging.query, lagging.params);

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
            value: row.actual,
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
