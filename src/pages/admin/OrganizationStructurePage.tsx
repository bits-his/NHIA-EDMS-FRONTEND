import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { authApi } from '@/api/auth';

export default function OrganizationStructurePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-org-hierarchy'],
    queryFn: () => authApi.getOrgHierarchy(),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizational structure"
        description="National Headquarters through zones, state offices, directorates, departments, and units."
      />

      {error && (
        <p className="text-sm text-destructive">Unable to load hierarchy. Ensure you are signed in as an administrator.</p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Headquarters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(data.headquarters ?? []).map((hq) => (
                <div key={hq.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="font-semibold">{hq.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{hq.code}</p>
                  <div className="mt-1 flex gap-1">
                    <Badge variant={hq.is_active ? 'default' : 'secondary'}>{hq.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Zones & state offices
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto space-y-3 text-sm pr-1">
              {(data.zones ?? []).map((z) => (
                <div key={z.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{z.code}</span>
                    {z.name}
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {z.stateOffices?.length ?? 0} states
                    </Badge>
                  </div>
                  <ul className="mt-2 ml-2 space-y-1 border-l-2 border-primary/20 pl-3">
                    {(z.stateOffices ?? []).map((s) => (
                      <li key={s.id} className="flex items-center gap-1 text-muted-foreground">
                        <ChevronRight className="h-3 w-3 shrink-0 text-primary" />
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Directorates & departments</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
              {(data.directorates ?? []).map((dir: Record<string, unknown>) => (
                <div key={Number(dir.id)} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <p className="font-semibold text-foreground">{String(dir.name ?? '')}</p>
                  <ul className="mt-2 space-y-2">
                    {((dir.departments as Array<Record<string, unknown>> | undefined) ?? []).map((dep) => (
                      <li key={Number(dep.id)} className="rounded-md bg-muted/40 px-2 py-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{String(dep.name ?? '')}</span>
                          {dep.is_active === false && (
                            <Badge variant="secondary" className="text-[10px]">Legacy</Badge>
                          )}
                        </div>
                        <ul className="mt-1 ml-3 list-disc text-xs text-muted-foreground">
                          {((dep.units as Array<Record<string, unknown>> | undefined) ?? []).map((u) => (
                            <li key={Number(u.id)} className="flex items-center gap-1">
                              {String(u.name ?? '')}
                              {u.is_active === false && (
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">(legacy)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {(data.departmentsWithoutDirectorate ?? []).length > 0 && (
                <div className="rounded-xl border border-dashed border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Departments without directorate</p>
                  {(data.departmentsWithoutDirectorate as Array<{ id: number; name: string; is_active?: boolean }>).map((d) => (
                    <p key={d.id} className="text-sm flex items-center gap-2">
                      {d.name}
                      {d.is_active === false && (
                        <Badge variant="secondary" className="text-[10px]">Legacy</Badge>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
