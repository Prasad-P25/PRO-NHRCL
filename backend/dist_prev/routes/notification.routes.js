"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Get all notifications for current user
router.get('/', notification_controller_1.notificationController.getAll);
// Get unread count
router.get('/unread-count', notification_controller_1.notificationController.getUnreadCount);
// Mark notification as read
router.put('/:id/read', notification_controller_1.notificationController.markAsRead);
// Mark all as read
router.put('/mark-all-read', notification_controller_1.notificationController.markAllAsRead);
// Delete a notification
router.delete('/:id', notification_controller_1.notificationController.delete);
// Clear all notifications
router.delete('/', notification_controller_1.notificationController.clearAll);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map