export type OperationalInsight = {
  id: string;
  severity: 'info' | 'medium' | 'high';
  category: string;
  title: string;
  message: string;
  action: { label: string; path: string } | null;
};

export type OperationalDocumentWorkedItem = {
  document_id: string;
  title: string | null;
  ref_number: string | null;
  status: string | null;
  last_activity_at: string;
  involvement: string;
  involvement_label: string;
  step_number: number | null;
};

export type OperationalTaskQueueItem = {
  id: string;
  step_number: number;
  status: string;
  document_id: string | null;
  document_title: string | null;
  ref_number: string | null;
  document_status: string | null;
  workflow_status: string | null;
  current_step: number | null;
  due_date: string | null;
  is_overdue: boolean;
  created_at: string;
};

export type PersonalOperationalDashboard = {
  generatedAt: string;
  period: { from: string; to: string };
  profile: {
    user_id: string;
    full_name: string | null;
    username: string | null;
    rank: string | null;
    department_name: string | null;
    zone_name: string | null;
    designation_title: string | null;
  };
  efficiency_score: {
    overall: number;
    components: {
      tasks_completed: number;
      documents_approved: number;
      task_responsiveness: number;
      documents_initiated: number;
      queue_management: number;
      workflow_quality: number;
      communication: number;
    };
  };
  workload: {
    active_tasks: number;
    overdue_tasks: number;
    pending_approvals: number;
    owned_pending_documents: number;
    owned_approved_documents?: number;
    owned_drafts: number;
    unread_notifications: number;
  };
  workflow_productivity: {
    tasks_completed: number;
    documents_initiated: number;
    documents_approved: number;
    owned_documents_approved?: number;
    avg_task_hours: number | null;
    median_task_hours: number | null;
    active_queue: number;
    overdue_count: number;
    revision_count: number;
  };
  reporting: {
    total_owned: number;
    pending_review: number;
    drafts: number;
    overdue_drafts: number;
    on_time_rate: number | null;
  };
  communication: {
    unresolved_discussions: number;
    pending_direct_messages: number;
    overdue_direct_messages: number;
    discussion_participation: number;
  };
  queues: {
    tasks: OperationalTaskQueueItem[];
    documents_worked: OperationalDocumentWorkedItem[];
    overdue_tasks: OperationalTaskQueueItem[];
    reporting_obligations: Array<{
      id: string;
      title: string | null;
      category: string | null;
      created_at: string;
    }>;
    direct_messages: Array<{
      id: string;
      document_id: string;
      title: string | null;
      ref_number: string | null;
      assigned_at: string;
      is_overdue: boolean;
    }>;
  };
  insights: OperationalInsight[];
  trends: Array<{ date: string; tasks_completed: number }>;
};

export type TeamOperationalVisibility = {
  scope: { type: string; label: string; view: string };
  generatedAt: string;
  period: { from: string; to: string };
  summary: {
    active_assignments: number;
    overdue_assignments: number;
    staff_with_workload: number;
    team_on_time_rate: number;
    median_response_hours: number | null;
    reporting_pending: number;
  };
  workload_balancing: {
    distribution: Array<{
      user_id: string;
      name: string | null;
      active: number;
      overdue: number;
    }>;
    average_active: number;
    overloaded: Array<{
      user_id: string;
      name: string | null;
      active: number;
      overdue: number;
    }>;
    underutilized: Array<{
      user_id: string;
      name: string | null;
      active: number;
      overdue: number;
    }>;
  };
  bottlenecks: Array<{ step_number: number; pending_count: number }>;
  insights: OperationalInsight[];
};
