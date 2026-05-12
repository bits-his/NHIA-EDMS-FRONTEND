export interface AuditLog {
  id: string;
  actor_id: string;
  /** Populated by audit agent from `users` for display (optional on older responses). */
  actor_username?: string | null;
  actor_full_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface CreateAuditLogRequest {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
}

export interface AuditLogsQuery {
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  /** Backend: 1–1000 for actor queries (ignored for entity queries). */
  limit?: number;
}
