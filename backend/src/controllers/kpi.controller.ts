import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

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
          targetValue || null,
          actualValue || null,
          manHoursWorked || null,
          incidentsCount || null,
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

      res.json({
        success: true,
        message: 'KPI entry updated successfully',
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

      // Get aggregated KPI data for current month across all packages
      const result = await db.query(`
        SELECT
          ki.id as indicator_id,
          ki.name,
          ki.type,
          ki.unit,
          ki.benchmark_value,
          AVG(ke.target_value) as avg_target,
          AVG(ke.actual_value) as avg_actual,
          COUNT(ke.id) as entry_count
        FROM kpi_indicators ki
        LEFT JOIN kpi_entries ke ON ki.id = ke.indicator_id
          AND ke.period_month = $1
          AND ke.period_year = $2
        GROUP BY ki.id, ki.name, ki.type, ki.unit, ki.benchmark_value, ki.display_order
        ORDER BY ki.type, ki.display_order
      `, [currentMonth, currentYear]);

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
