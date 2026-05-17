import type { ExecutiveScopeType, ExecutiveViewType } from '@/types/executive';

export interface PerformanceLeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string | null;
  username: string | null;
  rank_label: string | null;
  department_name: string | null;
  completed_count: number;
  workflow_completions: number;
  document_submissions: number;
  owner_actions: number;
  avg_hours_to_act: number;
  median_hours_to_act: number | null;
  on_time_count: number;
  on_time_rate: number;
  overdue_active: number;
}

export interface PerformanceTrendPoint {
  date: string;
  completed: number;
  avg_hours: number;
}

export interface PerformanceAnalyticsResponse {
  scope: {
    type: ExecutiveScopeType;
    label: string;
    view: ExecutiveViewType;
  };
  generatedAt: string;
  period: { from: string; to: string };
  slaDays: number;
  summary: {
    staffTracked: number;
    tasksCompleted: number;
    submissionsCompleted: number;
    ownerActionsCompleted: number;
    totalActions: number;
    avgHoursToAct: number | null;
    medianHoursToAct: number | null;
    onTimeRate: number;
    overdueActive: number;
  };
  leaderboard: PerformanceLeaderboardEntry[];
  trends: PerformanceTrendPoint[];
}
