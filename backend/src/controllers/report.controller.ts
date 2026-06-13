import { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

export interface ReportFilters {
  projectId?: number | string | null;
  packageId?: number | string | null;
  startDate?: string;
  endDate?: string;
  months?: number | string;
  categoryId?: number | string;
  riskRating?: string;
}

export const REPORT_TYPE_LABELS: Record<string, string> = {
  compliance: 'Compliance Summary',
  ncs: 'Non-Conformances',
  capa: 'CAPA Status',
  trends: 'Trend Analysis',
  comparison: 'Package Comparison',
  kpi: 'KPI Report',
};

// ---------------------------------------------------------------------------
// Shared data fetchers (used by API endpoints, on-demand export and the
// scheduled report generator in jobs/reportScheduler.ts)
// ---------------------------------------------------------------------------

export async function fetchComplianceSummaryData(filters: ReportFilters) {
  const { projectId, packageId, startDate, endDate } = filters;

  const params: any[] = [];
  let paramIndex = 1;

  // Date predicates belong in the LEFT JOIN ON clause: packages with no audits
  // in the range must still appear with zeros
  let joinClause = `LEFT JOIN audits a ON p.id = a.package_id AND a.status IN ('Approved', 'Closed')`;

  if (startDate) {
    joinClause += ` AND a.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    // Inclusive end date
    joinClause += ` AND a.created_at < $${paramIndex++}::date + INTERVAL '1 day'`;
    params.push(endDate);
  }

  let query = `
    SELECT p.code, p.name,
           COUNT(a.id) as total_audits,
           AVG(a.compliance_percentage) as avg_compliance,
           SUM(a.compliant_count) as total_compliant,
           SUM(a.non_compliant_count) as total_nc,
           SUM(a.na_count) as total_na
    FROM packages p
    ${joinClause}
    WHERE p.status = 'Active'
  `;

  if (projectId) {
    query += ` AND p.project_id = $${paramIndex++}`;
    params.push(projectId);
  }

  if (packageId) {
    query += ` AND p.id = $${paramIndex++}`;
    params.push(packageId);
  }

  query += ' GROUP BY p.id, p.code, p.name ORDER BY p.code';

  const result = await db.query(query, params);

  return result.rows.map((row) => ({
    packageCode: row.code,
    packageName: row.name,
    totalAudits: parseInt(row.total_audits),
    avgCompliance: parseFloat(row.avg_compliance || 0).toFixed(1),
    totalCompliant: parseInt(row.total_compliant || 0),
    totalNC: parseInt(row.total_nc || 0),
    totalNA: parseInt(row.total_na || 0),
  }));
}

export async function fetchNCsSummaryData(filters: ReportFilters) {
  const { projectId, packageId, categoryId, riskRating } = filters;

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

  return result.rows.map((row) => ({
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
  }));
}

export async function fetchCAPAStatusData(filters: ReportFilters) {
  const { projectId, packageId } = filters;

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

  return {
    statusCounts: result.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>),
    overdue: parseInt(overdueResult.rows[0].overdue),
  };
}

export async function fetchTrendAnalysisData(filters: ReportFilters) {
  const { projectId, packageId, months } = filters;

  // Sanitize before interpolating: months comes from the query string
  const numMonths = Math.min(Math.max(parseInt(String(months), 10) || 12, 1), 60);

  let query = `
    SELECT
      DATE_TRUNC('month', a.created_at) as month,
      AVG(a.compliance_percentage) as avg_compliance,
      SUM(a.non_compliant_count) as total_ncs,
      COUNT(a.id) as audit_count
    FROM audits a
    ${projectId ? 'JOIN packages p ON a.package_id = p.id' : ''}
    WHERE a.status IN ('Approved', 'Closed')
    AND a.created_at >= NOW() - INTERVAL '${numMonths} months'
  `;
  const params: any[] = [];
  let paramIndex = 1;

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

  return result.rows.map((row) => ({
    month: row.month,
    avgCompliance: parseFloat(row.avg_compliance || 0).toFixed(1),
    totalNCs: parseInt(row.total_ncs || 0),
    auditCount: parseInt(row.audit_count),
  }));
}

export async function fetchPackageComparisonData(filters: ReportFilters) {
  const { projectId } = filters;

  // Audits and CAPAs are aggregated per package in subqueries before joining,
  // otherwise the LEFT JOIN chain multiplies audit rows and inflates
  // COUNT/SUM/AVG values
  const params: any[] = [];
  let query = `
    SELECT p.id, p.code, p.name,
           COALESCE(am.total_audits, 0) as total_audits,
           am.avg_compliance,
           COALESCE(am.total_ncs, 0) as total_ncs,
           COALESCE(cm.open_capas, 0) as open_capas
    FROM packages p
    LEFT JOIN (
      SELECT a.package_id,
             COUNT(a.id) as total_audits,
             AVG(a.compliance_percentage) as avg_compliance,
             SUM(a.non_compliant_count) as total_ncs
      FROM audits a
      WHERE a.status IN ('Approved', 'Closed')
      GROUP BY a.package_id
    ) am ON am.package_id = p.id
    LEFT JOIN (
      SELECT a.package_id, COUNT(c.id) as open_capas
      FROM capa c
      JOIN audit_responses ar ON c.response_id = ar.id
      JOIN audits a ON ar.audit_id = a.id
      WHERE c.status != 'Closed'
        AND ar.status = 'NC'
        AND a.status IN ('Approved', 'Closed')
      GROUP BY a.package_id
    ) cm ON cm.package_id = p.id
    WHERE p.status = 'Active'
  `;

  if (projectId) {
    query += ' AND p.project_id = $1';
    params.push(projectId);
  }

  query += ' GROUP BY p.id, p.code, p.name, am.total_audits, am.avg_compliance, am.total_ncs, cm.open_capas ORDER BY p.code';

  const result = await db.query(query, params);

  return result.rows.map((row) => ({
    packageId: row.id,
    packageCode: row.code,
    packageName: row.name,
    totalAudits: parseInt(row.total_audits || 0),
    avgCompliance: parseFloat(row.avg_compliance || 0).toFixed(1),
    totalNCs: parseInt(row.total_ncs || 0),
    openCAPAs: parseInt(row.open_capas || 0),
  }));
}

export async function fetchKPIReportData(filters: ReportFilters) {
  const { projectId, packageId } = filters;

  let query = `
    SELECT ki.name as indicator_name, ki.type, ki.unit,
           p.code as package_code, p.name as package_name,
           ke.period_year, ke.period_month,
           ke.target_value, ke.actual_value,
           ke.man_hours_worked, ke.incidents_count, ke.remarks
    FROM kpi_entries ke
    JOIN kpi_indicators ki ON ke.indicator_id = ki.id
    JOIN packages p ON ke.package_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (projectId) {
    query += ` AND p.project_id = $${paramIndex++}`;
    params.push(projectId);
  }

  if (packageId) {
    query += ` AND ke.package_id = $${paramIndex++}`;
    params.push(packageId);
  }

  query += ' ORDER BY ke.period_year DESC, ke.period_month DESC, ki.type, ki.display_order, p.code';

  const result = await db.query(query, params);

  return result.rows.map((row) => ({
    indicator: row.indicator_name,
    type: row.type,
    unit: row.unit,
    packageCode: row.package_code,
    packageName: row.package_name,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    targetValue: row.target_value !== null ? parseFloat(row.target_value) : null,
    actualValue: row.actual_value !== null ? parseFloat(row.actual_value) : null,
    manHoursWorked: row.man_hours_worked !== null ? parseInt(row.man_hours_worked) : null,
    incidentsCount: row.incidents_count !== null ? parseInt(row.incidents_count) : null,
    remarks: row.remarks,
  }));
}

// ---------------------------------------------------------------------------
// File generation (Excel via the existing xlsx dependency, or CSV)
// ---------------------------------------------------------------------------

async function fetchReportRows(reportType: string, filters: ReportFilters): Promise<Record<string, any>[]> {
  switch (reportType) {
    case 'compliance':
      return fetchComplianceSummaryData(filters);
    case 'ncs':
      return fetchNCsSummaryData(filters);
    case 'capa': {
      const data = await fetchCAPAStatusData(filters);
      const rows = Object.entries(data.statusCounts).map(([status, count]) => ({ status, count }));
      rows.push({ status: 'Overdue (open, past target date)', count: data.overdue });
      return rows;
    }
    case 'trends':
      return fetchTrendAnalysisData(filters);
    case 'comparison':
      return fetchPackageComparisonData(filters);
    case 'kpi':
      return fetchKPIReportData(filters);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

export interface GeneratedReportFile {
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
}

// Generates the report file on disk and returns its metadata.
// Note: there is no PDF library in the backend, so 'pdf' requests fall back to
// xlsx and the returned format reflects what was actually produced.
export async function generateReportFile(
  reportType: string,
  format: string | undefined,
  filters: ReportFilters
): Promise<GeneratedReportFile> {
  const rows = await fetchReportRows(reportType, filters);

  const actualFormat = format === 'csv' ? 'csv' : 'xlsx';
  const reportsDir = path.join(process.env.UPLOAD_DIR || './uploads', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${reportType}-report-${timestamp}.${actualFormat}`;
  const filePath = path.join(reportsDir, fileName);

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [{ info: 'No data available for this report' }]
  );
  const workbook = XLSX.utils.book_new();
  const sheetName = (REPORT_TYPE_LABELS[reportType] || 'Report').substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filePath, actualFormat === 'csv' ? { bookType: 'csv' } : undefined);

  const fileSize = fs.statSync(filePath).size;

  return { filePath, fileName, fileSize, format: actualFormat };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class ReportController {
  getComplianceSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, startDate, endDate } = req.query;

      const data = await fetchComplianceSummaryData({
        projectId: req.projectId,
        packageId: packageId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getNCsSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, categoryId, riskRating } = req.query;

      const data = await fetchNCsSummaryData({
        projectId: req.projectId,
        packageId: packageId as string,
        categoryId: categoryId as string,
        riskRating: riskRating as string,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getCAPAStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId } = req.query;

      const data = await fetchCAPAStatusData({
        projectId: req.projectId,
        packageId: packageId as string,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getTrendAnalysis = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, months = 12 } = req.query;

      const data = await fetchTrendAnalysisData({
        projectId: req.projectId,
        packageId: packageId as string,
        months: months as string,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getPackageComparison = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await fetchPackageComparisonData({ projectId: req.projectId });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reportType, format, ...filters } = req.body;

      if (!reportType || !REPORT_TYPE_LABELS[reportType]) {
        return res.status(400).json({
          success: false,
          message: `Invalid report type. Valid types: ${Object.keys(REPORT_TYPE_LABELS).join(', ')}`,
        });
      }

      const file = await generateReportFile(reportType, format, {
        ...filters,
        projectId: req.projectId,
      });

      res.download(file.filePath, file.fileName, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
