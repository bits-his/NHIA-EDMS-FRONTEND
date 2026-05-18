import type { Executive360Response } from '@/types/executive';
import type { PersonalOperationalDashboard, TeamOperationalVisibility } from '@/types/operational';
import type { PerformanceAnalyticsResponse } from '@/types/performance';

export type ReportingHubScope = {
  type: string;
  label: string;
  view: string;
  oversight: boolean;
};

export type ReportingHubPeriod = {
  from: string;
  to: string;
};

export type ReportingHubWorkflowIntelligence = {
  tasks_in_period: number;
  completed: number;
  completion_rate: number | null;
  overdue_active: number;
  revision_loops: number;
  rejected_documents: number;
  avg_turnaround_hours: number | null;
  median_turnaround_hours: number | null;
  bottleneck_steps: Array<{ step_number: number; active_count: number }>;
};

export type ReportingHubSla = {
  sla_days: number;
  completed_in_period: number;
  on_time_count: number;
  on_time_rate: number | null;
  overdue_active: number;
  delayed_approvals: number;
};

export type ReportingHubAudit = {
  total_events: number;
  top_actions: Array<{ action: string; count: number }>;
  compliance_signals: number;
  activity_trend: Array<{ date: string; count: number }>;
};

export type ReportingHubOrgRollupRow = {
  id: number | null;
  name: string;
  documents: number;
  pending: number;
};

export type ReportingHubOrgAggregation = {
  zones: ReportingHubOrgRollupRow[];
  state_offices: ReportingHubOrgRollupRow[];
  departments: ReportingHubOrgRollupRow[];
  directorates: ReportingHubOrgRollupRow[];
  reporting_by_category: Array<{
    category: string;
    total: number;
    pending: number;
  }>;
};

export type ReportingHubCompliance = {
  summary: {
    total: number;
    pending: number;
    drafts: number;
    overdue_drafts: number;
    approved: number;
    on_time_rate: number | null;
  };
  by_zone: Array<{
    id: number | null;
    name: string;
    total: number;
    pending: number;
    drafts: number;
  }>;
  categories: string[];
  personal?: boolean;
};

export type ReportingHubInsight = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
  title: string;
  message: string;
  link: string;
};

export type ReportingHubPeriodComparison = {
  previous_period: { from: string; to: string };
  metrics: Array<{
    key: string;
    label: string;
    current: number;
    previous: number;
    change_pct: number;
  }>;
};

export type ReportingHubEscalations = {
  total: number;
  by_kind: {
    reminder: number;
    escalation: number;
    breached: number;
    resumed: number;
  };
  includes_overdue_tasks?: boolean;
  trend: Array<{ date: string; count: number }>;
  recent: Array<{
    id: number | string;
    event_kind: string;
    created_at: string;
    due_at: string | null;
    document_id: number;
    title: string | null;
    ref_number: string | null;
  }>;
};

export type ReportingHubCorrespondence = {
  summary: {
    total: number;
    incoming: number;
    outgoing: number;
    other: number;
    pending: number;
  };
  by_zone: Array<{ name: string; incoming: number; outgoing: number }>;
};

export type ReportingHubRegistry = {
  scope: { scope: string; label: string };
  total: number;
  by_status: {
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
    archived: number;
  };
  recent: Array<{
    id: number;
    title: string;
    ref_number: string | null;
    status: string;
    category: string;
    updated_at: string;
    owner_id: number;
  }>;
};

export type ReportingHubPayload = {
  generatedAt: string;
  period: ReportingHubPeriod;
  scope: ReportingHubScope;
  filters: {
    applied: Record<string, unknown>;
    reporting_categories: string[];
    options?: {
      zones: Array<{ id: number; code: string; name: string }>;
      stateOffices: Array<{ id: number; name: string; zone_code: string }>;
      departments: Array<{ id: number; name: string }>;
      directorates: Array<{ id: number; name: string }>;
    } | null;
  };
  operational: {
    personal: PersonalOperationalDashboard | null;
    personal_summary: {
      efficiency_score: PersonalOperationalDashboard['efficiency_score'];
      workload: PersonalOperationalDashboard['workload'];
      workflow_productivity: PersonalOperationalDashboard['workflow_productivity'];
      reporting: PersonalOperationalDashboard['reporting'];
      communication: PersonalOperationalDashboard['communication'];
    } | null;
    real_time: {
      active_tasks: number;
      overdue_tasks: number;
      active_workflows: number;
      pending_documents: number;
      reporting_pending: number;
    } | null;
    trend: Array<{ date: string; document_activity: number }>;
    task_trend: Array<{ date: string; tasks_completed: number }>;
  };
  team: TeamOperationalVisibility | null;
  reporting_compliance: ReportingHubCompliance | null;
  executive: {
    snapshot: Executive360Response;
    org_aggregation: ReportingHubOrgAggregation;
    performance: PerformanceAnalyticsResponse | null;
  } | null;
  workflow_intelligence: ReportingHubWorkflowIntelligence;
  sla: ReportingHubSla | null;
  audit_compliance: ReportingHubAudit | null;
  period_comparison: ReportingHubPeriodComparison | null;
  escalations: ReportingHubEscalations | null;
  correspondence: ReportingHubCorrespondence | null;
  registry_documents: ReportingHubRegistry | null;
  insights: ReportingHubInsight[];
  drill_down_base: string;
};

export type ReportingHubQuery = {
  from?: string;
  to?: string;
  zone_id?: string;
  state_office_id?: string;
  department_id?: string;
  directorate_id?: string;
  unit_id?: string;
};
