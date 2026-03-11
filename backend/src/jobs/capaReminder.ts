import { db } from '../database/connection';
import { emailService } from '../services/email.service';
import { createNotification } from '../controllers/notification.controller';
import { logger } from '../utils/logger';
import { format } from 'date-fns';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Check for overdue and due-soon CAPAs and send notifications
export async function checkCapaReminders() {
  logger.info('Running CAPA reminder check...');

  try {
    // Get overdue CAPAs (not closed, past target date)
    const overdueResult = await db.query(`
      SELECT
        c.id, c.capa_number, c.finding_description, c.target_date,
        CURRENT_DATE - c.target_date as days_overdue,
        pm.id as manager_id, pm.email as manager_email, pm.name as manager_name
      FROM capa c
      JOIN audit_responses ar ON c.response_id = ar.id
      JOIN audits a ON ar.audit_id = a.id
      JOIN packages p ON a.package_id = p.id
      JOIN users pm ON pm.package_id = p.id
      JOIN roles r ON pm.role_id = r.id
      WHERE c.status != 'Closed'
      AND c.target_date < CURRENT_DATE
      AND r.name = 'Package Manager'
      AND pm.is_active = true
    `);

    // Send overdue notifications
    for (const capa of overdueResult.rows) {
      // In-app notification
      await createNotification(
        capa.manager_id,
        'capa_overdue',
        'CAPA Overdue',
        `${capa.capa_number} is ${capa.days_overdue} day(s) overdue. Immediate action required.`,
        {
          entityType: 'capa',
          entityId: capa.id,
          actionUrl: `/capa?id=${capa.id}`,
          priority: 'urgent',
        }
      );

      // Email notification
      await emailService.sendCapaOverdue(capa.manager_email, {
        capaNumber: capa.capa_number,
        finding: capa.finding_description?.substring(0, 200) + (capa.finding_description?.length > 200 ? '...' : ''),
        dueDate: format(new Date(capa.target_date), 'PPP'),
        daysOverdue: parseInt(capa.days_overdue),
        link: `${APP_URL}/capa?id=${capa.id}`,
      });
    }

    // Get CAPAs due within 3 days (not closed, target date within 3 days)
    const dueSoonResult = await db.query(`
      SELECT
        c.id, c.capa_number, c.finding_description, c.target_date,
        c.target_date - CURRENT_DATE as days_left,
        pm.id as manager_id, pm.email as manager_email, pm.name as manager_name
      FROM capa c
      JOIN audit_responses ar ON c.response_id = ar.id
      JOIN audits a ON ar.audit_id = a.id
      JOIN packages p ON a.package_id = p.id
      JOIN users pm ON pm.package_id = p.id
      JOIN roles r ON pm.role_id = r.id
      WHERE c.status != 'Closed'
      AND c.target_date >= CURRENT_DATE
      AND c.target_date <= CURRENT_DATE + INTERVAL '3 days'
      AND r.name = 'Package Manager'
      AND pm.is_active = true
    `);

    // Send due-soon notifications
    for (const capa of dueSoonResult.rows) {
      // In-app notification
      await createNotification(
        capa.manager_id,
        'capa_due_soon',
        'CAPA Due Soon',
        `${capa.capa_number} is due in ${capa.days_left} day(s).`,
        {
          entityType: 'capa',
          entityId: capa.id,
          actionUrl: `/capa?id=${capa.id}`,
          priority: 'high',
        }
      );

      // Email notification
      await emailService.sendCapaDueSoon(capa.manager_email, {
        capaNumber: capa.capa_number,
        finding: capa.finding_description?.substring(0, 200) + (capa.finding_description?.length > 200 ? '...' : ''),
        dueDate: format(new Date(capa.target_date), 'PPP'),
        daysLeft: parseInt(capa.days_left),
        link: `${APP_URL}/capa?id=${capa.id}`,
      });
    }

    logger.info(`CAPA reminder check complete. Overdue: ${overdueResult.rowCount}, Due soon: ${dueSoonResult.rowCount}`);
  } catch (error) {
    logger.error('Error in CAPA reminder check:', error);
  }
}

// Start the daily job (runs every 24 hours)
export function startCapaReminderJob() {
  // Run immediately on startup
  checkCapaReminders();

  // Then run every 24 hours (86400000 ms)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(checkCapaReminders, TWENTY_FOUR_HOURS);

  logger.info('CAPA reminder job started (runs every 24 hours)');
}
