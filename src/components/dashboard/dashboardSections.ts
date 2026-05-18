/** Anchor IDs for in-page scroll from alerts and KPI cards. */
export const DASHBOARD_SECTION = {
  pendingApproval: 'dashboard-pending-approval',
  overdueTasks: 'dashboard-overdue-tasks',
} as const;

export function scrollToDashboardSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export type DashboardAlertItem = {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  count: number;
  link: string;
  scrollTarget?: string;
};
