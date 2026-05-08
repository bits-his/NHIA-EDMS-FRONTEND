import type { DocumentStatus } from '@/types/document';
import type { TaskStatus } from '@/types/task';
import type { WorkflowStatus } from '@/types/workflow';

export const DOCUMENT_STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  draft: {
    label: 'Draft',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    dot: 'bg-slate-400',
  },
  pending: {
    label: 'Pending Review',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'Approved',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/30',
    dot: 'bg-red-500',
  },
  archived: {
    label: 'Archived',
    color: 'text-slate-500 dark:text-slate-500',
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    dot: 'bg-slate-400',
  },
};

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/30',
  },
};

export const WORKFLOW_STATUS_CONFIG: Record<
  WorkflowStatus,
  { label: string; color: string; bg: string }
> = {
  active: {
    label: 'Active',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
};

export const QUERY_KEYS = {
  documents: 'documents',
  document: (id: string) => ['document', id],
  documentVersions: (id: string) => ['document-versions', id],
  workflows: 'workflows',
  workflowTemplates: 'workflow-templates',
  workflow: (id: string) => ['workflow', id],
  tasks: (assigneeId: string) => ['tasks', assigneeId],
  task: (id: string) => ['task', id],
  auditLogs: (query: object) => ['audit-logs', query],
  notifications: (userId: string) => ['notifications', userId],
  notificationsUnread: (userId: string) => ['notifications-unread', userId],
  orchestratorStatus: (docId: string) => ['orchestrator-status', docId],
  allDocuments: 'all-documents',
} as const;

export const OCR_ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/tiff': ['.tiff', '.tif'],
  'image/bmp': ['.bmp'],
};

export const MAX_OCR_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Seeded user IDs — used to discover documents across all users
 * since the backend has no document list endpoint.
 * These come from seeds/001_sample_data.js
 */
export const SEEDED_USER_IDS = [
  'a0000001-0000-0000-0000-000000000001', // alice (admin)
  'b0000002-0000-0000-0000-000000000002', // bob (reviewer)
  'c0000003-0000-0000-0000-000000000003', // charlie (submitter)
];

/**
 * Seeded document IDs — always fetchable regardless of audit log history.
 */
export const SEEDED_DOCUMENT_IDS = [
  'd1000001-0000-0000-0000-000000000001', // Q1 Financial Report (approved)
  'd2000002-0000-0000-0000-000000000002', // Employee Handbook Update (pending)
  'd3000003-0000-0000-0000-000000000003', // Project Proposal - New CRM (draft)
];
