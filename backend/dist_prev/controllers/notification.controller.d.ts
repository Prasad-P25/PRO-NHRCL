import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
        roleId: number;
        packageId?: number;
    };
}
export type NotificationType = 'capa_assigned' | 'capa_due_soon' | 'capa_overdue' | 'capa_response' | 'capa_verified' | 'audit_assigned' | 'audit_submitted' | 'audit_approved' | 'audit_rejected' | 'maturity_completed' | 'system';
export declare class NotificationController {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getUnreadCount(req: AuthRequest, res: Response): Promise<void>;
    markAsRead(req: AuthRequest, res: Response): Promise<void>;
    markAllAsRead(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    clearAll(req: AuthRequest, res: Response): Promise<void>;
}
export declare function createNotification(userId: number, type: NotificationType, title: string, message: string, options?: {
    fromUserId?: number;
    entityType?: string;
    entityId?: number;
    actionUrl?: string;
    priority?: 'low' | 'normal' | 'high';
}): Promise<void>;
export declare function notifyUsers(userIds: number[], type: NotificationType, title: string, message: string, options?: {
    fromUserId?: number;
    entityType?: string;
    entityId?: number;
    actionUrl?: string;
    priority?: 'low' | 'normal' | 'high';
}): Promise<void>;
export declare function getUsersByRole(roleName: string): Promise<number[]>;
export declare function getPackageManagers(packageId: number): Promise<number[]>;
export declare function getPackageManagersWithEmail(packageId: number): Promise<Array<{
    id: number;
    email: string;
    name: string;
}>>;
export declare function getUserEmail(userId: number): Promise<{
    email: string;
    name: string;
} | null>;
export declare const notificationController: NotificationController;
export {};
//# sourceMappingURL=notification.controller.d.ts.map