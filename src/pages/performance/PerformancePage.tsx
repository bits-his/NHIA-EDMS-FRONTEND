import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, ListTodo } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  PersonalOperationalPanel,
  TeamOperationalPanel,
} from '@/components/operational/OperationalCommandCenter';
import { OrganisationPerformanceSection } from '@/components/performance/OrganisationPerformanceSection';
import {
  buildPerformanceTabs,
  PerformanceOrganizationSkeleton,
  PerformancePersonalSkeleton,
  PerformanceStaffSkeleton,
  PerformanceTabSwitcher,
  PerformanceToolbar,
  type PerformanceTab,
} from '@/components/performance/performancePageUi';
import {
  periodParamsFromPreset,
  type DashboardPeriodPreset,
} from '@/components/dashboard/DashboardPeriodSelect';
import { operationalApi } from '@/api/operational';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import {
  canAccessPerformanceTracking,
  canViewPersonalPerformanceTab,
  isJuniorStaffOnly,
} from '@/utils/permissions';

function normalizeTabParam(
  raw: string | null,
  showPersonalTab: boolean,
  canOrganisationView: boolean
): PerformanceTab {
  if (raw === 'organisation' || raw === 'organization') return 'organization';
  if (raw === 'staff') return 'staff';
  if (raw === 'personal' && showPersonalTab) return 'personal';
  if (!showPersonalTab && canOrganisationView) return 'organization';
  if (showPersonalTab) return 'personal';
  return 'personal';
}

function resolvePageTitle(tab: PerformanceTab): string {
  if (tab === 'personal') return 'My performance';
  if (tab === 'organization') return 'Organization performance';
  return 'Staff performance';
}

function resolvePageDescription(
  tab: PerformanceTab,
  opts: {
    isJuniorStaff: boolean;
    departmentName?: string | null;
    scopeLabel?: string | null;
  }
): string {
  if (tab === 'organization') {
    return opts.scopeLabel
      ? `Team workload, bottlenecks, and operational signals for ${opts.scopeLabel}.`
      : 'Organisation-wide team workload and operational health for your scope.';
  }
  if (tab === 'staff') {
    return opts.scopeLabel
      ? `Staff rankings and completion trends for ${opts.scopeLabel}.`
      : 'Leaderboard and trends for tasks, document initiation, and approvals.';
  }
  if (opts.isJuniorStaff) {
    return 'Tasks completed, documents handled, and how quickly you clear assigned work.';
  }
  if (opts.departmentName) {
    return `Your workflow metrics for ${opts.departmentName}.`;
  }
  return 'Your efficiency score, active workload, and queues for this period.';
}

export default function PerformancePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const canOrganisationView = canAccessPerformanceTracking(roles, permissions);
  const showPersonalTab = canViewPersonalPerformanceTab(roles);
  const isJuniorStaff = isJuniorStaffOnly(roles);

  const performanceTabs = useMemo(
    () =>
      buildPerformanceTabs({
        showPersonal: showPersonalTab,
        showOrganisation: canOrganisationView,
      }),
    [showPersonalTab, canOrganisationView]
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [period, setPeriod] = useState<DashboardPeriodPreset>('30');
  const queryParams = useMemo(() => periodParamsFromPreset(period), [period]);

  const tab = normalizeTabParam(tabParam, showPersonalTab, canOrganisationView);

  useEffect(() => {
    const allowed = performanceTabs.some((t) => t.id === tab);
    if (!allowed && performanceTabs.length > 0) {
      setSearchParams({ tab: performanceTabs[0].id }, { replace: true });
    }
  }, [tab, performanceTabs, setSearchParams]);

  const personalQuery = useQuery({
    queryKey: QUERY_KEYS.operationalPersonal(queryParams),
    queryFn: () => operationalApi.getPersonal(queryParams),
    enabled: !!user?.user_id && tab === 'personal',
    staleTime: 30_000,
  });

  const teamQuery = useQuery({
    queryKey: QUERY_KEYS.operationalTeam(queryParams),
    queryFn: () => operationalApi.getTeam(queryParams),
    enabled: canOrganisationView && tab === 'organization',
    staleTime: 30_000,
  });

  const switchTab = (next: PerformanceTab) => {
    setSearchParams({ tab: next });
  };

  const scopeLabel =
    tab === 'organization' || tab === 'staff' ? teamQuery.data?.scope.label : null;

  const pageTitle = resolvePageTitle(tab);
  const pageDescription = resolvePageDescription(tab, {
    isJuniorStaff,
    departmentName: personalQuery.data?.profile.department_name,
    scopeLabel,
  });

  const isPersonalLoading =
    tab === 'personal' && personalQuery.isLoading && !personalQuery.data;
  const isOrganizationLoading =
    tab === 'organization' && teamQuery.isLoading && !teamQuery.data;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            {tab === 'personal' &&
            personalQuery.data &&
            personalQuery.data.workload.overdue_tasks > 0 ? (
              <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
                <ListTodo className="h-4 w-4" />
                My tasks
              </Button>
            ) : null}
            {isJuniorStaff ? (
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : null}
          </div>
        }
      />

      <PerformanceToolbar
        period={period}
        onPeriodChange={setPeriod}
        periodFrom={queryParams.from}
        periodTo={queryParams.to}
        scopeLabel={scopeLabel}
      />

      <PerformanceTabSwitcher
        tabs={performanceTabs}
        tab={tab}
        onTabChange={switchTab}
      />

      <div
        role="tabpanel"
        id={`performance-panel-${tab}`}
        aria-labelledby={`performance-tab-${tab}`}
        className="min-h-[320px]"
      >
        {tab === 'personal' ? (
          <>
            {personalQuery.error ? (
              <ErrorState
                title="Could not load your performance"
                error={personalQuery.error}
                onRetry={() => personalQuery.refetch()}
              />
            ) : isPersonalLoading ? (
              <PerformancePersonalSkeleton />
            ) : personalQuery.data ? (
              <PersonalOperationalPanel
                data={personalQuery.data}
                loading={personalQuery.isFetching && personalQuery.isLoading}
              />
            ) : null}
          </>
        ) : null}

        {tab === 'organization' && canOrganisationView ? (
          <>
            {teamQuery.error ? (
              <ErrorState
                title="Could not load organization data"
                error={teamQuery.error}
                onRetry={() => teamQuery.refetch()}
              />
            ) : isOrganizationLoading ? (
              <PerformanceOrganizationSkeleton />
            ) : teamQuery.data ? (
              <div className="animate-in fade-in duration-300">
                <TeamOperationalPanel
                  data={teamQuery.data}
                  loading={teamQuery.isFetching && !teamQuery.isLoading}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'staff' && canOrganisationView ? (
          <div className="animate-in fade-in duration-300">
            <OrganisationPerformanceSection
              queryParams={queryParams}
              showFooterActions={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
