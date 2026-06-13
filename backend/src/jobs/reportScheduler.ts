import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import { generateReportFile, REPORT_TYPE_LABELS, ReportFilters } from '../controllers/report.controller';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

interface ScheduleLike {
  id?: number | null;
  name: string;
  report_type: string;
  format: string;
  filters: any;
  recipients?: any;
  schedule_type?: string;
  schedule_day?: number | null;
  schedule_time?: string;
}

export interface GenerationOutcome {
  generatedReportId: number;
  status: 'completed' | 'failed';
  filePath?: string;
  error?: string;
}

/**
 * Compute the next run timestamp for a schedule. Uses `?? ` so that scheduleDay
 * 0 (Sunday) is respected rather than falling through to Monday.
 */
export function calculateNextRun(scheduleType: string, scheduleDay: number | null, scheduleTime: string): Date {
  const now = new Date();
  const [hours, minutes] = (scheduleTime || '08:00').split(':').map(Number);

  const nextRun = new Date(now);
  nextRun.setHours(hours || 0, minutes || 0, 0, 0);

  switch (scheduleType) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly': {
      const targetDay = scheduleDay ?? 1; // 0 = Sunday
      const currentDay = nextRun.getDay();
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      break;
    }
    case 'monthly': {
      const targetDate = scheduleDay ?? 1; // 1-28
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
    }
  }

  return nextRun;
}

function normalizeFilters(raw: any): ReportFilters {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

/**
 * Generate a report file, record a generated_reports row with the REAL outcome
 * (completed with file metadata, or failed with an error message — never a fake
 * "completed"), and email recipients when email is enabled. Shared by the
 * scheduler and the on-demand controller endpoints.
 */
export async function generateAndRecordReport(
  schedule: ScheduleLike,
  generatedBy: number | null
): Promise<GenerationOutcome> {
  // Insert a pending row first so history reflects in-progress generation.
  const pending = await db.query(
    `INSERT INTO generated_reports
       (scheduled_report_id, name, report_type, format, filters, status, generated_by)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     RETURNING id`,
    [
      schedule.id ?? null,
      schedule.name,
      schedule.report_type,
      schedule.format,
      typeof schedule.filters === 'string' ? schedule.filters : JSON.stringify(schedule.filters || {}),
      generatedBy,
    ]
  );
  const generatedReportId = pending.rows[0].id;

  try {
    const filters = normalizeFilters(schedule.filters);
    const file = await generateReportFile(schedule.report_type, schedule.format, filters);

    await db.query(
      `UPDATE generated_reports
       SET status = 'completed', file_path = $1, file_size = $2, format = $3, completed_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [file.filePath, file.fileSize, file.format, generatedReportId]
    );

    // Notify recipients (best-effort; never fails the generation)
    const recipients: string[] = Array.isArray(schedule.recipients)
      ? schedule.recipients
      : normalizeFilters(schedule.recipients) as any;
    if (Array.isArray(recipients) && recipients.length > 0) {
      const label = REPORT_TYPE_LABELS[schedule.report_type] || schedule.report_type;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3B82F6; color: white; padding: 16px; text-align: center;">
            <h2 style="margin: 0;">PROTECTHER Audit Panel</h2>
          </div>
          <div style="padding: 20px; background-color: #f9fafb;">
            <p>The scheduled report <strong>${schedule.name}</strong> (${label}) has been generated.</p>
            <p>File: ${file.fileName} (${Math.round(file.fileSize / 1024)} KB)</p>
            <p>Log in to the panel to download it from Reports &rarr; History.</p>
          </div>
        </div>`;
      await Promise.all(
        recipients.map((to) =>
          emailService.sendEmail(to, `[Report] ${schedule.name} is ready`, html).catch((err) =>
            logger.error('Failed to email scheduled report recipient:', err)
          )
        )
      );
    }

    return { generatedReportId, status: 'completed', filePath: file.filePath };
  } catch (error: any) {
    await db.query(
      `UPDATE generated_reports
       SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [error?.message || 'Report generation failed', generatedReportId]
    );
    logger.error(`Scheduled report generation failed for "${schedule.name}":`, error);
    return { generatedReportId, status: 'failed', error: error?.message };
  }
}

// Find due schedules and run them, then advance next_run_at.
export async function processDueReports(): Promise<void> {
  try {
    const due = await db.query(
      `SELECT * FROM scheduled_reports
       WHERE is_active = true AND next_run_at IS NOT NULL AND next_run_at <= NOW()`
    );

    if (due.rows.length === 0) return;

    logger.info(`Report scheduler: ${due.rows.length} due report(s)`);

    for (const schedule of due.rows) {
      await generateAndRecordReport(schedule, schedule.created_by ?? null);

      const nextRunAt = calculateNextRun(
        schedule.schedule_type,
        schedule.schedule_day,
        schedule.schedule_time
      );
      await db.query(
        `UPDATE scheduled_reports SET last_run_at = CURRENT_TIMESTAMP, next_run_at = $1 WHERE id = $2`,
        [nextRunAt, schedule.id]
      );
    }
  } catch (error) {
    logger.error('Error in report scheduler tick:', error);
  }
}

export function startReportSchedulerJob(): void {
  // Run shortly after boot, then on a fixed interval.
  setTimeout(processDueReports, 30 * 1000);
  setInterval(processDueReports, CHECK_INTERVAL_MS);
  logger.info('Report scheduler job started (checks every 15 minutes)');
}
