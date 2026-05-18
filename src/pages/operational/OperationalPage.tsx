import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Gauge, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  PersonalOperationalPanel,
  TeamOperationalPanel,
} from '@/components/operational/OperationalCommandCenter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { operationalApi } from '@/api/operational';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { canViewOperationalOverview, isJuniorStaffOnly } from '@/utils/permissions';
import { cn } from '@/utils/cn';

type PeriodPreset = '7' | '30' | '90';
type Tab = 'personal' | 'team';

function periodRange(preset: PeriodPreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Number(preset));
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function OperationalPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const canTeam = canViewOperationalOverview(roles, permissions);
  const isJuniorStaff = isJuniorStaffOnly(roles);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(tabParam === 'team' && canTeam ? 'team' : 'personal');
  const [period, setPeriod] = useState<PeriodPreset>('30');
  const queryParams = useMemo(() => periodRange(period), [period]);

  const personalQuery = useQuery({
    queryKey: QUERY_KEYS.operationalPersonal(queryParams),
    queryFn: () => operationalApi.getPersonal(queryParams),
    enabled: !!user?.user_id,
    staleTime: 30_000,
  });

  const teamQuery = useQuery({
    queryKey: QUERY_KEYS.operationalTeam(queryParams),
    queryFn: () => operationalApi.getTeam(queryParams),
    enabled: canTeam && tab === 'team',
    staleTime: 30_000,
  });

  const switchTab = (next: Tab) => {
    setTab(next);
    if (next === 'team') {
      setSearchParams({ tab: 'team' });
    } else {
      setSearchParams({});
    }
  };

  if (personalQuery.error) {
    return (
      <ErrorState
        title="Could not load operational data"
        error={personalQuery.error}
        onRetry={() => personalQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isJuniorStaff ? 'My performance' : 'Operational command centre'}
        description={
          tab === 'team' && teamQuery.data
            ? `${teamQuery.data.scope.label} · Team workload, bottlenecks, and operational intelligence`
            : personalQuery.data
              ? isJuniorStaff
                ? `Your workflow contribution — tasks completed, documents initiated and approved, and time on document-linked tasks.`
                : `Personal workflow efficiency · ${personalQuery.data.profile.department_name || 'NHIA'}`
              : isJuniorStaff
                ? 'Your personal workflow performance from tasks and documents in the system.'
                : 'Workflow productivity and operational insights from live platform activity'
        }
        actions={
          <div className="flex items-center gap-2">
            {isJuniorStaff && (
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </Button>
            )}
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          </div>
        }
      />

      {canTeam && (
        <div className="flex gap-2 p-1 rounded-xl bg-muted/40 border border-border/60 w-fit">
          <button
            type="button"
            onClick={() => switchTab('personal')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === 'personal'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Gauge className="h-4 w-4" />
            My operations
          </button>
          <button
            type="button"
            onClick={() => switchTab('team')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === 'team'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="h-4 w-4" />
            Team & department
          </button>
        </div>
      )}

      {tab === 'personal' && personalQuery.data && (
        <PersonalOperationalPanel
          data={personalQuery.data}
          loading={personalQuery.isLoading}
        />
      )}

      {tab === 'team' && canTeam && (
        teamQuery.error ? (
          <ErrorState
            title="Could not load team data"
            error={teamQuery.error}
            onRetry={() => teamQuery.refetch()}
          />
        ) : teamQuery.data ? (
          <TeamOperationalPanel data={teamQuery.data} loading={teamQuery.isLoading} />
        ) : null
      )}
    </div>
  );
}
