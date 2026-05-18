import { executiveDrill } from '@/utils/executiveDrillDown';
import { DASHBOARD_SECTION } from '@/components/dashboard/dashboardSections';
import type { Executive360Response } from '@/types/executive';

export function mapDashboardAlerts(alerts: Executive360Response['alerts']) {
  return alerts.map((a) => {
    let link = a.link;
    let scrollTarget: string | undefined;

    if (a.type === 'reporting_pending') {
      link = '/reports?tab=reporting';
    } else if (a.type === 'overdue_tasks') {
      link = executiveDrill.overdueTasks();
      scrollTarget = DASHBOARD_SECTION.overdueTasks;
    } else if (a.type === 'stalled_workflows') {
      link = executiveDrill.stalledWorkflows();
    } else if (a.type === 'pending_approvals') {
      link = executiveDrill.documentsByStatus('pending');
      scrollTarget = DASHBOARD_SECTION.pendingApproval;
    }

    return { ...a, link, scrollTarget };
  });
}
