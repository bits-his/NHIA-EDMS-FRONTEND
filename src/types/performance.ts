import type { ExecutiveScopeType, ExecutiveViewType } from '@/types/executive';

export interface PerformanceLeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string | null;
  username: string | null;
  rank_label: string | null;
  department_name: string | null;
  tasks_completed: number;
  documents_initiated: number;
  documents_approved: number;
  /** Completed arrival→action episodes (document assigned to staff until they acted). */
  documents_acted?: number;
  total_contribution: number;
  avg_task_hours: number | null;
  median_task_hours: number | null;
  avg_response_hours?: number | null;
  median_response_hours?: number | null;
  avg_approval_hours: number | null;
  overdue_active: number;
  pending_assignments?: number;
}

export interface PerformanceTrendPoint {
  date: string;
  tasks_completed: number;
  avg_task_hours: number;
}

export interface PerformanceAnalyticsResponse {
  scope: {
    type: ExecutiveScopeType;
    label: string;
    view: ExecutiveViewType;
  };
  generatedAt: string;
  period: { from: string; to: string };
  summary: {
    staffTracked: number;
    tasksCompleted: number;
    documentsInitiated: number;
    documentsApproved: number;
    totalContributions: number;
    avgTaskHours: number | null;
    medianTaskHours: number | null;
    avgResponseHours?: number | null;
    medianResponseHours?: number | null;
    overdueActive: number;
  };
  leaderboard: PerformanceLeaderboardEntry[];
  trends: PerformanceTrendPoint[];
}
