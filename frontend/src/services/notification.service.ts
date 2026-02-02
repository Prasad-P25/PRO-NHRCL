import api from './api';

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  from_user_id?: number;
  from_user_name?: string;
  entity_type?: string;
  entity_id?: number;
  action_url?: string;
  priority: 'low' | 'normal' | 'high';
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationService = {
  // Get all notifications
  getAll: async (params?: { unreadOnly?: boolean; limit?: number; offset?: number }) => {
    const response = await api.get<NotificationsResponse>('/notifications', { params });
    return response.data;
  },

  // Get unread count
  getUnreadCount: async () => {
    const response = await api.get<UnreadCountResponse>('/notifications/unread-count');
    return response.data;
  },

  // Mark as read
  markAsRead: async (id: number) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  // Mark all as read
  markAllAsRead: async () => {
    const response = await api.put('/notifications/mark-all-read');
    return response.data;
  },

  // Delete notification
  delete: async (id: number) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  // Clear all notifications
  clearAll: async () => {
    const response = await api.delete('/notifications');
    return response.data;
  },
};

export default notificationService;
