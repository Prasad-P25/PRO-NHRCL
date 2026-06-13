"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = exports.NotificationController = void 0;
exports.createNotification = createNotification;
exports.notifyUsers = notifyUsers;
exports.getUsersByRole = getUsersByRole;
exports.getPackageManagers = getPackageManagers;
exports.getPackageManagersWithEmail = getPackageManagersWithEmail;
exports.getUserEmail = getUserEmail;
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
class NotificationController {
    // Get notifications for current user
    async getAll(req, res) {
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
            const params = [userId];
            if (unreadOnly === 'true') {
                query += ` AND n.is_read = false`;
            }
            query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
            const result = await connection_1.db.query(query, params);
            // Get total count
            const countResult = await connection_1.db.query(`SELECT COUNT(*) FROM notifications WHERE user_id = $1${unreadOnly === 'true' ? ' AND is_read = false' : ''}`, [userId]);
            // Get unread count
            const unreadResult = await connection_1.db.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false', [userId]);
            res.json({
                data: result.rows,
                total: parseInt(countResult.rows[0].count),
                unreadCount: parseInt(unreadResult.rows[0].count),
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching notifications:', error);
            res.status(500).json({ message: 'Failed to fetch notifications' });
        }
    }
    // Get unread count
    async getUnreadCount(req, res) {
        try {
            const userId = req.user?.id;
            const result = await connection_1.db.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false', [userId]);
            res.json({ count: parseInt(result.rows[0].count) });
        }
        catch (error) {
            logger_1.logger.error('Error fetching unread count:', error);
            res.status(500).json({ message: 'Failed to fetch unread count' });
        }
    }
    // Mark notification as read
    async markAsRead(req, res) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            await connection_1.db.query('UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2', [id, userId]);
            res.json({ message: 'Notification marked as read' });
        }
        catch (error) {
            logger_1.logger.error('Error marking notification as read:', error);
            res.status(500).json({ message: 'Failed to mark notification as read' });
        }
    }
    // Mark all notifications as read
    async markAllAsRead(req, res) {
        try {
            const userId = req.user?.id;
            await connection_1.db.query('UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false', [userId]);
            res.json({ message: 'All notifications marked as read' });
        }
        catch (error) {
            logger_1.logger.error('Error marking all notifications as read:', error);
            res.status(500).json({ message: 'Failed to mark all notifications as read' });
        }
    }
    // Delete a notification
    async delete(req, res) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            await connection_1.db.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
            res.json({ message: 'Notification deleted' });
        }
        catch (error) {
            logger_1.logger.error('Error deleting notification:', error);
            res.status(500).json({ message: 'Failed to delete notification' });
        }
    }
    // Clear all notifications
    async clearAll(req, res) {
        try {
            const userId = req.user?.id;
            await connection_1.db.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
            res.json({ message: 'All notifications cleared' });
        }
        catch (error) {
            logger_1.logger.error('Error clearing notifications:', error);
            res.status(500).json({ message: 'Failed to clear notifications' });
        }
    }
}
exports.NotificationController = NotificationController;
// Helper function to create notifications (used by other controllers)
async function createNotification(userId, type, title, message, options) {
    try {
        await connection_1.db.query(`INSERT INTO notifications (user_id, type, title, message, from_user_id, entity_type, entity_id, action_url, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            userId,
            type,
            title,
            message,
            options?.fromUserId || null,
            options?.entityType || null,
            options?.entityId || null,
            options?.actionUrl || null,
            options?.priority || 'normal',
        ]);
    }
    catch (error) {
        logger_1.logger.error('Error creating notification:', error);
    }
}
// Helper function to notify multiple users
async function notifyUsers(userIds, type, title, message, options) {
    for (const userId of userIds) {
        await createNotification(userId, type, title, message, options);
    }
}
// Helper to get users by role
async function getUsersByRole(roleName) {
    const result = await connection_1.db.query(`SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = $1 AND u.is_active = true`, [roleName]);
    return result.rows.map(r => r.id);
}
// Helper to get package managers for a package
async function getPackageManagers(packageId) {
    const result = await connection_1.db.query(`SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.package_id = $1 AND r.name = 'Package Manager' AND u.is_active = true`, [packageId]);
    return result.rows.map(r => r.id);
}
// Helper to get package managers with email for a package
async function getPackageManagersWithEmail(packageId) {
    const result = await connection_1.db.query(`SELECT u.id, u.email, u.name FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.package_id = $1 AND r.name = 'Package Manager' AND u.is_active = true`, [packageId]);
    return result.rows;
}
// Helper to get user email by ID
async function getUserEmail(userId) {
    const result = await connection_1.db.query(`SELECT email, name FROM users WHERE id = $1 AND is_active = true`, [userId]);
    return result.rows[0] || null;
}
exports.notificationController = new NotificationController();
//# sourceMappingURL=notification.controller.js.map