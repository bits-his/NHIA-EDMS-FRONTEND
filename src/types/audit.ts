export interface AuditLog {
  id: string;
  actor_id: string;
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
}
