import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'PROTECTHER Audit Panel <noreply@protecther.com>';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

// Create transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Email templates
const templates = {
  capaCreated: (data: { capaNumber: string; auditNumber: string; finding: string; assigneeName: string; dueDate: string; link: string }) => ({
    subject: `[CAPA] New CAPA Created: ${data.capaNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #3B82F6; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">PROTECTHER Audit Panel</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2 style="color: #1f2937;">New CAPA Created</h2>
          <p>A new Corrective and Preventive Action has been created and assigned to you.</p>

          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">CAPA Number:</td>
                <td style="padding: 8px 0; font-weight: bold;">${data.capaNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">From Audit:</td>
                <td style="padding: 8px 0;">${data.auditNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Finding:</td>
                <td style="padding: 8px 0;">${data.finding}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Assigned To:</td>
                <td style="padding: 8px 0;">${data.assigneeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
                <td style="padding: 8px 0; color: #EF4444; font-weight: bold;">${data.dueDate}</td>
              </tr>
            </table>
          </div>

          <a href="${data.link}" style="display: inline-block; background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            View CAPA Details
          </a>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from PROTECTHER Audit Panel.</p>
        </div>
      </div>
    `,
  }),

  capaDueSoon: (data: { capaNumber: string; finding: string; dueDate: string; daysLeft: number; link: string }) => ({
    subject: `[CAPA] Due Soon: ${data.capaNumber} - ${data.daysLeft} day(s) left`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #F59E0B; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">PROTECTHER Audit Panel</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2 style="color: #92400E;">CAPA Due Soon</h2>
          <p>This CAPA is due in <strong>${data.daysLeft} day(s)</strong>. Please take action.</p>

          <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin: 20px 0;">
            <p style="margin: 0;"><strong>${data.capaNumber}</strong></p>
            <p style="margin: 5px 0 0 0; color: #6b7280;">${data.finding}</p>
            <p style="margin: 5px 0 0 0;">Due Date: <strong>${data.dueDate}</strong></p>
          </div>

          <a href="${data.link}" style="display: inline-block; background-color: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Take Action Now
          </a>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from PROTECTHER Audit Panel.</p>
        </div>
      </div>
    `,
  }),

  capaOverdue: (data: { capaNumber: string; finding: string; dueDate: string; daysOverdue: number; link: string }) => ({
    subject: `[URGENT] CAPA Overdue: ${data.capaNumber} - ${data.daysOverdue} day(s) overdue`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #EF4444; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">PROTECTHER Audit Panel</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2 style="color: #991B1B;">CAPA OVERDUE - Immediate Action Required</h2>
          <p>This CAPA is <strong>${data.daysOverdue} day(s) overdue</strong>. Please take immediate action.</p>

          <div style="background-color: #FEE2E2; padding: 15px; border-radius: 8px; border-left: 4px solid #EF4444; margin: 20px 0;">
            <p style="margin: 0;"><strong>${data.capaNumber}</strong></p>
            <p style="margin: 5px 0 0 0; color: #6b7280;">${data.finding}</p>
            <p style="margin: 5px 0 0 0; color: #EF4444;">Was Due: <strong>${data.dueDate}</strong></p>
          </div>

          <a href="${data.link}" style="display: inline-block; background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Resolve Now
          </a>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from PROTECTHER Audit Panel.</p>
        </div>
      </div>
    `,
  }),

  capaCompleted: (data: { capaNumber: string; finding: string; completedBy: string; completedDate: string; link: string }) => ({
    subject: `[CAPA] Completed: ${data.capaNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #22C55E; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">PROTECTHER Audit Panel</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2 style="color: #166534;">CAPA Completed</h2>
          <p>A CAPA has been marked as completed and is pending verification.</p>

          <div style="background-color: #DCFCE7; padding: 15px; border-radius: 8px; border-left: 4px solid #22C55E; margin: 20px 0;">
            <p style="margin: 0;"><strong>${data.capaNumber}</strong></p>
            <p style="margin: 5px 0 0 0; color: #6b7280;">${data.finding}</p>
            <p style="margin: 5px 0 0 0;">Completed By: ${data.completedBy}</p>
            <p style="margin: 5px 0 0 0;">Date: ${data.completedDate}</p>
          </div>

          <a href="${data.link}" style="display: inline-block; background-color: #22C55E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Verify CAPA
          </a>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from PROTECTHER Audit Panel.</p>
        </div>
      </div>
    `,
  }),
};

// Email service functions
export const emailService = {
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!EMAIL_ENABLED) {
      logger.info(`Email disabled. Would send to ${to}: ${subject}`);
      return true;
    }

    if (!SMTP_USER || !SMTP_PASS) {
      logger.warn('SMTP credentials not configured. Email not sent.');
      return false;
    }

    try {
      await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        html,
      });
      logger.info(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  },

  async sendCapaCreated(to: string, data: Parameters<typeof templates.capaCreated>[0]): Promise<boolean> {
    const { subject, html } = templates.capaCreated(data);
    return this.sendEmail(to, subject, html);
  },

  async sendCapaDueSoon(to: string, data: Parameters<typeof templates.capaDueSoon>[0]): Promise<boolean> {
    const { subject, html } = templates.capaDueSoon(data);
    return this.sendEmail(to, subject, html);
  },

  async sendCapaOverdue(to: string, data: Parameters<typeof templates.capaOverdue>[0]): Promise<boolean> {
    const { subject, html } = templates.capaOverdue(data);
    return this.sendEmail(to, subject, html);
  },

  async sendCapaCompleted(to: string, data: Parameters<typeof templates.capaCompleted>[0]): Promise<boolean> {
    const { subject, html } = templates.capaCompleted(data);
    return this.sendEmail(to, subject, html);
  },

  // Verify SMTP connection
  async verifyConnection(): Promise<boolean> {
    if (!EMAIL_ENABLED) {
      logger.info('Email is disabled');
      return false;
    }

    try {
      await transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection failed:', error);
      return false;
    }
  },
};

export default emailService;
