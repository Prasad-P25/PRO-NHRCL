import { Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import { calculateNextRun, generateAndRecordReport } from '../jobs/reportScheduler';

export class ScheduledReportController {
  // Get all scheduled reports
  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT sr.*, u.name as creator_name
         FROM scheduled_reports sr
         LEFT JOIN users u ON sr.created_by = u.id
         ORDER BY sr.created_at DESC`
      );

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          reportType: row.report_type,
          format: row.format,
          filters: row.filters,
          scheduleType: row.schedule_type,
          scheduleDay: row.schedule_day,
          scheduleTime: row.schedule_time,
          recipients: row.recipients,
          isActive: row.is_active,
          lastRunAt: row.last_run_at,
          nextRunAt: row.next_run_at,
          createdBy: row.created_by,
          creatorName: row.creator_name,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // Get single scheduled report
  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        `SELECT sr.*, u.name as creator_name
         FROM scheduled_reports sr
         LEFT JOIN users u ON sr.created_by = u.id
         WHERE sr.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Scheduled report not found' });
      }

      const row = result.rows[0];
      res.json({
        success: true,
        data: {
          id: row.id,
          name: row.name,
          reportType: row.report_type,
          format: row.format,
          filters: row.filters,
          scheduleType: row.schedule_type,
          scheduleDay: row.schedule_day,
          scheduleTime: row.schedule_time,
          recipients: row.recipients,
          isActive: row.is_active,
          lastRunAt: row.last_run_at,
          nextRunAt: row.next_run_at,
          createdBy: row.created_by,
          creatorName: row.creator_name,
          createdAt: row.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Create scheduled report
  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        reportType,
        format,
        filters,
        scheduleType,
        scheduleDay,
        scheduleTime,
        recipients,
        isActive = true,
      } = req.body;

      if (!name || !reportType || !scheduleType) {
        return res.status(400).json({ success: false, message: 'Name, report type, and schedule type are required' });
      }

      const nextRunAt = isActive ? calculateNextRun(scheduleType, scheduleDay, scheduleTime || '08:00') : null;

      const result = await db.query(
        `INSERT INTO scheduled_reports
         (name, report_type, format, filters, schedule_type, schedule_day, schedule_time, recipients, is_active, next_run_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          name,
          reportType,
          format || 'pdf',
          JSON.stringify(filters || {}),
          scheduleType,
          scheduleDay || null,
          scheduleTime || '08:00',
          JSON.stringify(recipients || []),
          isActive,
          nextRunAt,
          req.user!.id,
        ]
      );

      const row = result.rows[0];
      res.status(201).json({
        success: true,
        message: 'Scheduled report created successfully',
        data: {
          id: row.id,
          name: row.name,
          reportType: row.report_type,
          format: row.format,
          filters: row.filters,
          scheduleType: row.schedule_type,
          scheduleDay: row.schedule_day,
          scheduleTime: row.schedule_time,
          recipients: row.recipients,
          isActive: row.is_active,
          nextRunAt: row.next_run_at,
          createdAt: row.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Update scheduled report
  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        name,
        reportType,
        format,
        filters,
        scheduleType,
        scheduleDay,
        scheduleTime,
        recipients,
        isActive,
      } = req.body;

      // Check if exists
      const existing = await db.query('SELECT * FROM scheduled_reports WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Scheduled report not found' });
      }

      const currentRow = existing.rows[0];
      const newScheduleType = scheduleType ?? currentRow.schedule_type;
      const newScheduleDay = scheduleDay ?? currentRow.schedule_day;
      const newScheduleTime = scheduleTime ?? currentRow.schedule_time;
      const newIsActive = isActive ?? currentRow.is_active;

      const nextRunAt = newIsActive ? calculateNextRun(newScheduleType, newScheduleDay, newScheduleTime) : null;

      const result = await db.query(
        `UPDATE scheduled_reports
         SET name = COALESCE($1, name),
             report_type = COALESCE($2, report_type),
             format = COALESCE($3, format),
             filters = COALESCE($4, filters),
             schedule_type = COALESCE($5, schedule_type),
             schedule_day = $6,
             schedule_time = COALESCE($7, schedule_time),
             recipients = COALESCE($8, recipients),
             is_active = COALESCE($9, is_active),
             next_run_at = $10,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $11
         RETURNING *`,
        [
          name || null,
          reportType || null,
          format || null,
          filters ? JSON.stringify(filters) : null,
          scheduleType || null,
          newScheduleDay,
          scheduleTime || null,
          recipients ? JSON.stringify(recipients) : null,
          isActive,
          nextRunAt,
          id,
        ]
      );

      const row = result.rows[0];
      res.json({
        success: true,
        message: 'Scheduled report updated successfully',
        data: {
          id: row.id,
          name: row.name,
          reportType: row.report_type,
          format: row.format,
          filters: row.filters,
          scheduleType: row.schedule_type,
          scheduleDay: row.schedule_day,
          scheduleTime: row.schedule_time,
          recipients: row.recipients,
          isActive: row.is_active,
          nextRunAt: row.next_run_at,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete scheduled report
  delete = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query('DELETE FROM scheduled_reports WHERE id = $1 RETURNING id', [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Scheduled report not found' });
      }

      res.json({ success: true, message: 'Scheduled report deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  // Toggle active status
  toggleActive = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const existing = await db.query('SELECT * FROM scheduled_reports WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Scheduled report not found' });
      }

      const row = existing.rows[0];
      const newIsActive = !row.is_active;
      const nextRunAt = newIsActive
        ? calculateNextRun(row.schedule_type, row.schedule_day, row.schedule_time)
        : null;

      await db.query(
        'UPDATE scheduled_reports SET is_active = $1, next_run_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [newIsActive, nextRunAt, id]
      );

      res.json({
        success: true,
        message: `Scheduled report ${newIsActive ? 'activated' : 'deactivated'} successfully`,
        data: { isActive: newIsActive, nextRunAt },
      });
    } catch (error) {
      next(error);
    }
  };

  // Run report manually (generate now)
  runNow = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const existing = await db.query('SELECT * FROM scheduled_reports WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Scheduled report not found' });
      }

      const schedule = existing.rows[0];

      // Actually generate the file and record the real outcome
      const outcome = await generateAndRecordReport(schedule, req.user!.id);

      // Update last run timestamp
      await db.query(
        'UPDATE scheduled_reports SET last_run_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      if (outcome.status === 'failed') {
        return res.status(500).json({
          success: false,
          message: `Report generation failed: ${outcome.error || 'unknown error'}`,
          data: { id: outcome.generatedReportId, status: 'failed' },
        });
      }

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          id: outcome.generatedReportId,
          status: 'completed',
          reportType: schedule.report_type,
          format: schedule.format,
          filters: schedule.filters,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get generated reports history
  getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { scheduleId } = req.query;

      let query = `
        SELECT gr.*, u.name as generator_name, sr.name as schedule_name
        FROM generated_reports gr
        LEFT JOIN users u ON gr.generated_by = u.id
        LEFT JOIN scheduled_reports sr ON gr.scheduled_report_id = sr.id
      `;
      const params: any[] = [];

      if (scheduleId) {
        query += ' WHERE gr.scheduled_report_id = $1';
        params.push(scheduleId);
      }

      query += ' ORDER BY gr.created_at DESC LIMIT 100';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          id: row.id,
          scheduledReportId: row.scheduled_report_id,
          scheduleName: row.schedule_name,
          name: row.name,
          reportType: row.report_type,
          format: row.format,
          filters: row.filters,
          filePath: row.file_path,
          fileSize: row.file_size,
          status: row.status,
          errorMessage: row.error_message,
          generatedBy: row.generated_by,
          generatorName: row.generator_name,
          createdAt: row.created_at,
          completedAt: row.completed_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // Generate on-demand report (not scheduled)
  generateReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, reportType, format, filters } = req.body;

      if (!reportType) {
        return res.status(400).json({ success: false, message: 'Report type is required' });
      }

      // Actually generate the file (scoped to the caller's project) and record
      // the real outcome instead of a fake "completed" row with no file.
      const outcome = await generateAndRecordReport(
        {
          id: null,
          name: name || `${reportType} Report`,
          report_type: reportType,
          format: format || 'xlsx',
          filters: { ...(filters || {}), projectId: req.projectId },
        },
        req.user!.id
      );

      if (outcome.status === 'failed') {
        return res.status(500).json({
          success: false,
          message: `Report generation failed: ${outcome.error || 'unknown error'}`,
          data: { id: outcome.generatedReportId, status: 'failed' },
        });
      }

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          id: outcome.generatedReportId,
          name: name || `${reportType} Report`,
          reportType,
          format: format || 'xlsx',
          status: 'completed',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete generated report
  deleteGenerated = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Get file path first to delete the file
      const existing = await db.query('SELECT file_path FROM generated_reports WHERE id = $1', [id]);
      if (existing.rows.length > 0 && existing.rows[0].file_path) {
        try {
          fs.unlinkSync(existing.rows[0].file_path);
        } catch (e) {
          // File may not exist, ignore
        }
      }

      const result = await db.query('DELETE FROM generated_reports WHERE id = $1 RETURNING id', [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Generated report not found' });
      }

      res.json({ success: true, message: 'Generated report deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
