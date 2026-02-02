import { Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    roleId: number;
    packageId?: number;
  };
}

// Notification types
export type NotificationType =
  | 'capa_assigned'
  | 'capa_due_soon'
  | 'capa_overdue'
  | 'capa_response'
  | 'capa_verified'
  | 'audit_assigned'
  | 'audit_submitted'
  | 'audit_approved'
  | 'audit_rejected'
  | 'maturity_completed'
  | 'system';

export class NotificationController {
  // Get notifications for current user
  async getAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { unreadOnly, limit = 20, offset = 0 } = req.query;

      let query = `
        SELECT n.*,
               u.name as from_user_name
        FROM notifications n
        LEFT JOIN users u ON n.from_user_id = u.id
        WHERE n.user_id = $1
      `;
      const params: any[] = [userId];

      if (unreadOnly === 'true') {
        query += ` AND n.is_read = false`;
      }

      query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1${unreadOnly === 'true' ? ' AND is_read = false' : ''}`,
        [userId]
      );

      // Get unread count
      const unreadResult = await db.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      res.json({
        data: result.rows,
        total: parseInt(countResult.rows[0].count),
        unreadCount: parseInt(unreadResult.rows[0].count),
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  }

  // Get unread count
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      const result = await db.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
      logger.error('Error fetching unread count:', error);
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  }

  // Mark notification as read
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      await db.query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      await db.query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
  }

  // Delete a notification
  async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      await db.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      res.json({ message: 'Notification deleted' });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({ message: 'Failed to delete notification' });
    }
  }

  // Clear all notifications
  async clearAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      await db.query('DELETE FROM notifications WHERE user_id = $1', [userId]);

      res.json({ message: 'All notifications cleared' });
    } catch (error) {
      logger.error('Error clearing notifications:', error);
      res.status(500).json({ message: 'Failed to clear notifications' });
    }
  }
}

// Helper function to create notifications (used by other controllers)
export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    fromUserId?: number;
    entityType?: string;
    entityId?: number;
    actionUrl?: string;
    priority?: 'low' | 'normal' | 'high';
  }
) {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, from_user_id, entity_type, entity_id, action_url, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        type,
        title,
        message,
        options?.fromUserId || null,
        options?.entityType || null,
        options?.entityId || null,
        options?.actionUrl || null,
        options?.priority || 'normal',
      ]
    );
  } catch (error) {
    logger.error('Error creating notification:', error);
  }
}

// Helper function to notify multiple users
export async function notifyUsers(
  userIds: number[],
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    fromUserId?: number;
    entityType?: string;
    entityId?: number;
    actionUrl?: string;
    priority?: 'low' | 'normal' | 'high';
  }
) {
  for (const userId of userIds) {
    await createNotification(userId, type, title, message, options);
  }
}

// Helper to get users by role
export async function getUsersByRole(roleName: string): Promise<number[]> {
  const result = await db.query(
    `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = $1 AND u.is_active = true`,
    [roleName]
  );
  return result.rows.map(r => r.id);
}

// Helper to get package managers for a package
export async function getPackageManagers(packageId: number): Promise<number[]> {
  const result = await db.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.package_id = $1 AND r.name = 'Package Manager' AND u.is_active = true`,
    [packageId]
  );
  return result.rows.map(r => r.id);
}

export const notificationController = new NotificationController();
