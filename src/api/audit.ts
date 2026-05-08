import { auditClient } from './client';
import type { AuditLog, CreateAuditLogRequest, AuditLogsQuery } from '@/types/audit';

export const auditApi = {
  log: async (data: CreateAuditLogRequest): Promise<AuditLog> => {
    const res = await auditClient.post<AuditLog>('/audit/log', data);
    return res.data;
  },

  /**
   * Query audit logs.
   * Backend accepts EITHER (entity_type + entity_id) OR actor_id — never mixed.
   */
  getLogs: async (query: AuditLogsQuery): Promise<AuditLog[]> => {
    // Build params strictly: entity path requires both fields, actor path is standalone
    let params: Record<string, string>;

    if (query.entity_type && query.entity_id) {
      params = { entity_type: query.entity_type, entity_id: query.entity_id };
    } else if (query.actor_id) {
      params = { actor_id: query.actor_id };
    } else {
      // Nothing valid to query — return empty rather than sending a bad request
      return [];
    }

    const res = await auditClient.get<AuditLog[]>('/audit/logs', { params });
    return res.data;
  },
};
