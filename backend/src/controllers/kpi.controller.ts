import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

// LTIFR/TRIFR are rate indicators whose actual value must be derived server-side:
// rate = (incidents x 1,000,000) / man-hours worked
const RATE_INDICATOR_PATTERN = /LTIFR|TRIFR/i;
const RATE_INDICATOR_SQL = `(ki.name ILIKE '%LTIFR%' OR ki.name ILIKE '%TRIFR%')`;

// Aggregate expression for actual values: rate indicators must be aggregated as
// SUM(incidents) * 1e6 / SUM(man-hours), not as an unweighted AVG of per-package rates.
const ACTUAL_AGGREGATE_SQL = `
          CASE
            WHEN ${RATE_INDICATOR_SQL}
              THEN COALESCE(SUM(ke.incidents_count) * 1000000.0 / NULLIF(SUM(ke.man_hours_worked), 0), AVG(ke.actual_value))
            ELSE AVG(ke.actual_value)
          END`;

function computeRateActual(incidentsCount: any, manHoursWorked: any): number | null {
  const incidents = Number(incidentsCount);
  const manHours = Number(manHoursWorked);
  if (incidentsCount === null || incidentsCount === undefined) return null;
  if (!Number.isFinite(incidents) || !Number.isFinite(manHours) || manHours <= 0) return null;
  return Math.round((incidents * 1000000 / manHours) * 100) / 100;
}

export class KPIController {
  getIndicators = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;

      let query = 'SELECT * FROM kpi_indicators WHERE 1=1';
      const params: any[] = [];

      if (type) {
        query += ' AND type = $1';
        params.push(type);
      }

      query += ' ORDER BY type, display_order';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((indicator) => ({
          id: indicator.id,
          type: indicator.type,
          category: indicator.category,
          name: indicator.name,
          definition: indicator.definition,
          formula: indicator.formula,
          unit: indicator.unit,
          benchmarkValue: indicator.benchmark_value,
          displayOrder: indicator.display_order,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  getEntries = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, indicatorId, periodMonth, periodYear } = req.query;
      const projectId = req.projectId;

      let query = `
        SELECT ke.*, ki.name as indicator_name, ki.type, ki.unit, ki.benchmark_value,
               p.code as package_code, p.name as package_name
        FROM kpi_entries ke
        JOIN kpi_indicators ki ON ke.indicator_id = ki.id
        JOIN packages p ON ke.package_id = p.id
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
        query += ` AND ke.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      if (indicatorId) {
        query += ` AND ke.indicator_id = $${paramIndex++}`;
        params.push(indicatorId);
      }

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
          packageId: entry.package_id,
          package: {
            id: entry.package_id,
            code: entry.package_code,
            name: entry.package_name,
          },
          indicatorId: entry.indicator_id,
          indicator: {
            id: entry.indicator_id,
            name: entry.indicator_name,
            type: entry.type,
            unit: entry.unit,
            benchmarkValue: entry.benchmark_value,
          },
          periodMonth: entry.period_month,
          periodYear: entry.period_year,
          targetValue: entry.target_value,
          actualValue: entry.actual_value,
          manHoursWorked: entry.man_hours_worked,
          incidentsCount: entry.incidents_count,
          remarks: entry.remarks,
          createdAt: entry.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  createEntry = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        packageId,
        indicatorId,
        periodMonth,
        periodYear,
        targetValue,
        actualValue,
        manHoursWorked,
        incidentsCount,
        remarks,
      } = req.body;

      // For rate indicators (LTIFR/TRIFR) compute the actual value server-side
      // instead of trusting the user-entered value
      let resolvedActualValue = actualValue ?? null;
      const indicatorResult = await db.query('SELECT name FROM kpi_indicators WHERE id = $1', [indicatorId]);
      const indicatorName = indicatorResult.rows[0]?.name || '';
      if (RATE_INDICATOR_PATTERN.test(indicatorName)) {
        const computed = computeRateActual(incidentsCount, manHoursWorked);
        if (computed !== null) {
          resolvedActualValue = computed;
        }
      }

      const result = await db.query(
        `INSERT INTO kpi_entries (package_id, indicator_id, period_month, period_year,
         target_value, actual_value, man_hours_worked, incidents_count, remarks, entered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (package_id, indicator_id, period_month, period_year) DO UPDATE SET
         target_value = EXCLUDED.target_value,
         actual_value = EXCLUDED.actual_value,
         man_hours_worked = EXCLUDED.man_hours_worked,
         incidents_count = EXCLUDED.incidents_count,
         remarks = EXCLUDED.remarks,
         entered_by = EXCLUDED.entered_by
         RETURNING *`,
        [
          packageId,
          indicatorId,
          periodMonth,
          periodYear,
          targetValue ?? null,
          resolvedActualValue,
          manHoursWorked ?? null,
          incidentsCount ?? null,
          remarks || null,
          req.user!.id,
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  };

  updateEntry = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { targetValue, actualValue, manHoursWorked, incidentsCount, remarks } = req.body;

      await db.query(
        `UPDATE kpi_entries SET
         target_value = COALESCE($1, target_value),
         actual_value = COALESCE($2, actual_value),
         man_hours_worked = COALESCE($3, man_hours_worked),
         incidents_count = COALESCE($4, incidents_count),
         remarks = COALESCE($5, remarks)
         WHERE id = $6`,
        [targetValue, actualValue, manHoursWorked, incidentsCount, remarks, id]
      );

      // For rate indicators (LTIFR/TRIFR) recompute the actual value from the
      // stored incidents and man-hours after the partial update
      await db.query(
        `UPDATE kpi_entries ke
         SET actual_value = ROUND(ke.incidents_count * 1000000.0 / NULLIF(ke.man_hours_worked, 0), 2)
         FROM kpi_indicators ki
         WHERE ke.id = $1
           AND ki.id = ke.indicator_id
           AND ${RATE_INDICATOR_SQL}
           AND ke.incidents_count IS NOT NULL
           AND ke.man_hours_worked > 0`,
        [id]
      );

      res.json({
        success: true,
        message: 'KPI entry updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get KPI trends for last N months
  getTrends = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { months = 12, indicatorId, packageId } = req.query;
      const projectId = req.projectId;
      const numMonths = Math.min(parseInt(months as string) || 12, 24);

      const params: any[] = [numMonths];
      let paramIndex = 2;

      // Project/package predicates belong in the JOIN ON clause: putting them in
      // WHERE on a LEFT JOIN would drop indicator/month rows that only have
      // entries in other projects or packages
      let entryJoin = `
        LEFT JOIN kpi_entries ke ON ki.id = ke.indicator_id
          AND ke.period_month = m.month
          AND ke.period_year = m.year`;

      if (projectId) {
        entryJoin += `
          AND ke.package_id IN (SELECT id FROM packages WHERE project_id = $${paramIndex})`;
        params.push(projectId);
        paramIndex++;
      }

      if (packageId) {
        entryJoin += `
          AND ke.package_id = $${paramIndex}`;
        params.push(packageId);
        paramIndex++;
      }

      let query = `
        WITH months AS (
          SELECT
            date_trunc('month', NOW() - (n || ' months')::interval) as month_date,
            EXTRACT(MONTH FROM date_trunc('month', NOW() - (n || ' months')::interval))::int as month,
            EXTRACT(YEAR FROM date_trunc('month', NOW() - (n || ' months')::interval))::int as year
          FROM generate_series(0, $1 - 1) as n
        )
        SELECT
          m.month_date,
          m.month,
          m.year,
          ki.id as indicator_id,
          ki.name as indicator_name,
          ki.type,
          ki.unit,
          ki.benchmark_value,
          AVG(ke.target_value) as avg_target,
          ${ACTUAL_AGGREGATE_SQL} as avg_actual,
          SUM(ke.man_hours_worked) as total_man_hours,
          SUM(ke.incidents_count) as total_incidents
        FROM months m
        CROSS JOIN kpi_indicators ki
        ${entryJoin}
        WHERE 1=1
      `;

      if (indicatorId) {
        query += ` AND ki.id = $${paramIndex}`;
        params.push(indicatorId);
        paramIndex++;
      }

      query += `
        GROUP BY m.month_date, m.month, m.year, ki.id, ki.name, ki.type, ki.unit, ki.benchmark_value, ki.display_order
        ORDER BY m.month_date DESC, ki.type, ki.display_order
      `;

      const result = await db.query(query, params);

      // Group by indicator and format data for charts
      const indicatorMap = new Map();

      result.rows.forEach((row) => {
        if (!indicatorMap.has(row.indicator_id)) {
          indicatorMap.set(row.indicator_id, {
            id: row.indicator_id,
            name: row.indicator_name,
            type: row.type,
            unit: row.unit,
            benchmarkValue: row.benchmark_value,
            data: [],
          });
        }

        indicatorMap.get(row.indicator_id).data.push({
          month: row.month,
          year: row.year,
          monthLabel: new Date(row.year, row.month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          target: row.avg_target ? parseFloat(row.avg_target) : null,
          actual: row.avg_actual ? parseFloat(row.avg_actual) : null,
          manHours: row.total_man_hours ? parseInt(row.total_man_hours) : 0,
          incidents: row.total_incidents ? parseInt(row.total_incidents) : 0,
        });
      });

      // Sort data by date (oldest first for charts)
      indicatorMap.forEach((indicator) => {
        indicator.data.sort((a: any, b: any) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
      });

      res.json({
        success: true,
        data: Array.from(indicatorMap.values()),
      });
    } catch (error) {
      next(error);
    }
  };

  // Get KPI summary for dashboard gauges
  getSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const projectId = req.projectId;

      // Get aggregated KPI data for current month, filtered by project.
      // The project predicate lives in the JOIN ON clause so indicators with
      // entries only in other projects still appear (with NULL values).
      const params: any[] = [currentMonth, currentYear];
      let entryJoin = `
        LEFT JOIN kpi_entries ke ON ki.id = ke.indicator_id
          AND ke.period_month = $1
          AND ke.period_year = $2`;

      if (projectId) {
        entryJoin += `
          AND ke.package_id IN (SELECT id FROM packages WHERE project_id = $3)`;
        params.push(projectId);
      }

      const result = await db.query(`
        SELECT
          ki.id as indicator_id,
          ki.name,
          ki.type,
          ki.unit,
          ki.benchmark_value,
          AVG(ke.target_value) as avg_target,
          ${ACTUAL_AGGREGATE_SQL} as avg_actual,
          COUNT(ke.id) as entry_count
        FROM kpi_indicators ki
        ${entryJoin}
        GROUP BY ki.id, ki.name, ki.type, ki.unit, ki.benchmark_value, ki.display_order
        ORDER BY ki.type, ki.display_order
      `, params);

      const summary = result.rows.map((row) => {
        const isLowerBetter = row.name.includes('LTIFR') ||
          row.name.includes('Fatality') ||
          row.name.includes('Severity') ||
          row.name.includes('Incident');

        return {
          indicatorId: row.indicator_id,
          name: row.name,
          type: row.type,
          unit: row.unit,
          targetValue: row.avg_target ? parseFloat(row.avg_target) : (row.benchmark_value || 0),
          actualValue: row.avg_actual ? parseFloat(row.avg_actual) : null,
          benchmarkValue: row.benchmark_value,
          invertColors: isLowerBetter,
        };
      });

      // Calculate Overall Project KPI Score
      let totalScore = 0;
      let validKPIs = 0;

      for (const kpi of summary) {
        if (kpi.actualValue !== null && kpi.targetValue > 0) {
          let achievement: number;

          if (kpi.invertColors) {
            // For lower-is-better metrics (LTIFR, Fatality, etc.)
            // If actual is 0 and target > 0, that's perfect (100%)
            // If actual <= target, score is 100%
            // If actual > target, score decreases
            if (kpi.actualValue === 0) {
              achievement = 100;
            } else if (kpi.actualValue <= kpi.targetValue) {
              achievement = 100;
            } else {
              achievement = Math.max(0, (kpi.targetValue / kpi.actualValue) * 100);
            }
          } else {
            // For higher-is-better metrics
            achievement = Math.min(100, (kpi.actualValue / kpi.targetValue) * 100);
          }

          totalScore += achievement;
          validKPIs++;
        }
      }

      const overallScore = validKPIs > 0 ? Math.round(totalScore / validKPIs) : null;

      res.json({
        success: true,
        data: summary,
        overallKPI: {
          score: overallScore,
          kpisWithData: validKPIs,
          totalKPIs: summary.length,
          status: overallScore === null ? 'No Data' :
                  overallScore >= 90 ? 'Excellent' :
                  overallScore >= 75 ? 'Good' :
                  overallScore >= 60 ? 'Fair' : 'Needs Improvement'
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
