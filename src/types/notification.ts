export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type?: string;
  read: boolean;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}

export interface CreateNotificationRequest {
  user_id: string;
  message: string;
  type?: string;
  entity_type?: string;
  entity_id?: string;
}
