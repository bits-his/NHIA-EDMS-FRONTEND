import type { Executive360Response } from '@/types/executive';
import type { PersonalOperationalDashboard } from '@/types/operational';

export type DashboardLayout =
  | 'director_shell'
  | 'oversight'
  | 'officer'
  | 'personal';

export interface DashboardHomeResponse {
  layout: DashboardLayout;
  period: { from: string; to: string };
  generatedAt: string;
  personalOperational?: PersonalOperationalDashboard;
  executive360?: Executive360Response;
}
