import axios from 'axios';
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
      if (query.limit != null && Number.isFinite(query.limit)) {
        params.limit = String(Math.min(1000, Math.max(1, Math.floor(query.limit))));
      }
    } else {
      // Nothing valid to query — return empty rather than sending a bad request
      return [];
    }

    const res = await auditClient.get<AuditLog[]>('/audit/logs', { params });
    return res.data;
  },

  /**
   * Full timeline for a document: rows where entity is the document, its workflow instance(s),
   * or tasks on those instances (same ordering as backend: oldest first).
   */
  getLogsForDocument: async (documentId: string): Promise<AuditLog[]> => {
    try {
      const res = await auditClient.get<AuditLog[]>(`/audit/logs/for-document/${documentId}`);
      return res.data;
    } catch (e) {
      if (axios.isAxiosError(e) && (e.response?.status === 403 || e.response?.status === 404)) return [];
      throw e;
    }
  },

  /**
   * Newest-first feed (limit 1–200). Requires `view_audit_logs` or admin — returns [] on 403.
   */
  getRecentLogs: async (limit = 80): Promise<AuditLog[]> => {
    const n = Math.min(Math.max(Math.floor(limit) || 80, 1), 200);
    try {
      const res = await auditClient.get<AuditLog[]>('/audit/logs/recent', {
        params: { limit: String(n) },
      });
      return res.data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 403) return [];
      throw e;
    }
  },
};
