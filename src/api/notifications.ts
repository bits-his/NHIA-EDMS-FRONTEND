import { notificationClient } from './client';
import type { Notification, CreateNotificationRequest } from '@/types/notification';

export const notificationsApi = {
  create: async (data: CreateNotificationRequest): Promise<Notification> => {
    const res = await notificationClient.post<Notification>('/notifications', data);
    return res.data;
  },

  getAll: async (userId: string): Promise<Notification[]> => {
    const res = await notificationClient.get<Notification[]>('/notifications', {
      params: { user_id: userId },
    });
    return res.data;
  },

  getUnread: async (userId: string): Promise<Notification[]> => {
    const res = await notificationClient.get<Notification[]>('/notifications/unread', {
      params: { user_id: userId },
    });
    return res.data;
  },

  markRead: async (id: string): Promise<Notification> => {
    const res = await notificationClient.put<Notification>(`/notifications/${id}/read`);
    return res.data;
  },
};
