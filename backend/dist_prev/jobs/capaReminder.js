"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCapaReminders = checkCapaReminders;
exports.startCapaReminderJob = startCapaReminderJob;
const connection_1 = require("../database/connection");
const email_service_1 = require("../services/email.service");
const notification_controller_1 = require("../controllers/notification.controller");
const logger_1 = require("../utils/logger");
const date_fns_1 = require("date-fns");
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// Check for overdue and due-soon CAPAs and send notifications
async function checkCapaReminders() {
    logger_1.logger.info('Running CAPA reminder check...');
    try {
        // Get overdue CAPAs (not closed, past target date)
        const overdueResult = await connection_1.db.query(`
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
        // Send overdue notifications in parallel
        const overduePromises = overdueResult.rows.map(capa => {
            const notificationPromise = (0, notification_controller_1.createNotification)(capa.manager_id, 'capa_overdue', 'CAPA Overdue', `${capa.capa_number} is ${capa.days_overdue} day(s) overdue. Immediate action required.`, {
                entityType: 'capa',
                entityId: capa.id,
                actionUrl: `/capa?id=${capa.id}`,
                priority: 'high',
            }).catch(err => logger_1.logger.error('Failed to create overdue notification:', err));
            const emailPromise = email_service_1.emailService.sendCapaOverdue(capa.manager_email, {
                capaNumber: capa.capa_number,
                finding: capa.finding_description?.substring(0, 200) + (capa.finding_description?.length > 200 ? '...' : ''),
                dueDate: (0, date_fns_1.format)(new Date(capa.target_date), 'PPP'),
                daysOverdue: parseInt(capa.days_overdue),
                link: `${APP_URL}/capa?id=${capa.id}`,
            }).catch(err => logger_1.logger.error('Failed to send overdue email:', err));
            return Promise.all([notificationPromise, emailPromise]);
        });
        await Promise.all(overduePromises);
        // Get CAPAs due within 3 days (not closed, target date within 3 days)
        const dueSoonResult = await connection_1.db.query(`
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
        // Send due-soon notifications in parallel
        const dueSoonPromises = dueSoonResult.rows.map(capa => {
            const notificationPromise = (0, notification_controller_1.createNotification)(capa.manager_id, 'capa_due_soon', 'CAPA Due Soon', `${capa.capa_number} is due in ${capa.days_left} day(s).`, {
                entityType: 'capa',
                entityId: capa.id,
                actionUrl: `/capa?id=${capa.id}`,
                priority: 'high',
            }).catch(err => logger_1.logger.error('Failed to create due-soon notification:', err));
            const emailPromise = email_service_1.emailService.sendCapaDueSoon(capa.manager_email, {
                capaNumber: capa.capa_number,
                finding: capa.finding_description?.substring(0, 200) + (capa.finding_description?.length > 200 ? '...' : ''),
                dueDate: (0, date_fns_1.format)(new Date(capa.target_date), 'PPP'),
                daysLeft: parseInt(capa.days_left),
                link: `${APP_URL}/capa?id=${capa.id}`,
            }).catch(err => logger_1.logger.error('Failed to send due-soon email:', err));
            return Promise.all([notificationPromise, emailPromise]);
        });
        await Promise.all(dueSoonPromises);
        logger_1.logger.info(`CAPA reminder check complete. Overdue: ${overdueResult.rowCount}, Due soon: ${dueSoonResult.rowCount}`);
    }
    catch (error) {
        logger_1.logger.error('Error in CAPA reminder check:', error);
    }
}
// Start the daily job (runs every 24 hours)
function startCapaReminderJob() {
    // Run immediately on startup
    checkCapaReminders();
    // Then run every 24 hours (86400000 ms)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    setInterval(checkCapaReminders, TWENTY_FOUR_HOURS);
    logger_1.logger.info('CAPA reminder job started (runs every 24 hours)');
}
//# sourceMappingURL=capaReminder.js.map