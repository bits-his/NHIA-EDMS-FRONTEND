import { Building2, Lock, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';

interface EnterprisePageBannerProps {
  environment: 'production' | 'internal';
  className?: string;
}

export function EnterprisePageBanner({ environment, className }: EnterprisePageBannerProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-4 py-4 md:px-6 md:py-5 shadow-md',
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/15">
            <Building2 className="h-7 w-7 text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-semibold">
                Federal Government EDMS
              </span>
              <Badge className="bg-emerald-600/90 hover:bg-emerald-600 text-[10px] px-2 py-0 h-5 border-0">
                <Shield className="h-3 w-3 mr-1" aria-hidden />
                Secure workflow
              </Badge>
              <Badge variant="outline" className="border-white/25 text-white/90 text-[10px] px-2 py-0 h-5 bg-white/5">
                <Lock className="h-3 w-3 mr-1" aria-hidden />
                Records-compliant
              </Badge>
            </div>
            <p className="text-sm text-white/85 leading-snug">
              Federal Ministry / Agency template governance — NHIA-compatible enterprise records architecture.
            </p>
            <p className="text-[11px] text-white/55">
              Agency logo placeholder · Authorized personnel only · Immutable audit trail on publish
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge
            className={cn(
              'text-[10px] uppercase tracking-wide px-3 py-1 border-0',
              environment === 'production'
                ? 'bg-rose-600/90 text-white'
                : 'bg-amber-500/90 text-slate-950'
            )}
          >
            {environment === 'production' ? 'Production' : 'Internal / staging'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
