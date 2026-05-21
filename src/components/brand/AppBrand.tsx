import { NHIA_LOGO_SRC } from '@/constants/brandAssets';
import { SYSTEM_NAME, SYSTEM_NAME_BITS, SYSTEM_NAME_EDMS } from '@/constants/brand';
import { cn } from '@/utils/cn';

export type AppBrandVariant =
  | 'sidebar'
  | 'sidebar-collapsed'
  | 'login-hero'
  | 'login-compact'
  | 'loader';

interface AppBrandProps {
  variant: AppBrandVariant;
  className?: string;
}

function LogoMark({ className, alt = 'BITS EDMS' }: { className?: string; alt?: string }) {
  return (
    <img src={NHIA_LOGO_SRC} alt={alt} className={cn('w-auto object-contain', className)} />
  );
}

/** BITS EDMS wordmark — primary green accent on BITS. */
function SystemWordmark({
  className,
  tone = 'sidebar',
  size = 'md',
}: {
  className?: string;
  tone?: 'sidebar' | 'light' | 'inverted';
  size?: 'sm' | 'md' | 'lg';
}) {
  const titleClass =
    size === 'lg'
      ? 'text-2xl xl:text-[1.65rem]'
      : size === 'sm'
        ? 'text-xs'
        : 'text-[15px]';

  const titleTone =
    tone === 'inverted'
      ? 'text-white'
      : tone === 'light'
        ? 'text-foreground'
        : 'text-sidebar-foreground';
  const edmsTone =
    tone === 'inverted'
      ? 'text-white/95'
      : tone === 'light'
        ? 'text-foreground/85'
        : 'text-sidebar-foreground/90';
  const bitsAccent = tone === 'inverted' ? 'text-emerald-300' : 'text-primary';

  return (
    <div className={cn('flex flex-col leading-none min-w-0', className)}>
      <p className={cn('font-bold tracking-tight', titleClass, titleTone)}>
        <span className={bitsAccent}>{SYSTEM_NAME_BITS}</span>
        <span className={cn('font-semibold', edmsTone)}>
          {' '}
          {SYSTEM_NAME_EDMS}
        </span>
      </p>
    </div>
  );
}

/** Organisation logo + BITS EDMS product wordmark. */
export function AppBrand({ variant, className }: AppBrandProps) {
  if (variant === 'sidebar') {
    return (
      <div className={cn('flex items-center gap-2.5 min-w-0 w-full', className)}>
        <div className="shrink-0 rounded-lg bg-white px-2 py-1 shadow-sm ring-1 ring-black/5">
          <LogoMark className="h-11" />
        </div>
        <SystemWordmark className="flex-1" />
      </div>
    );
  }

  if (variant === 'sidebar-collapsed') {
    return (
      <div className={cn('flex flex-col items-center gap-1.5', className)} title={SYSTEM_NAME}>
        <div className="rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5">
          <LogoMark className="h-7" />
        </div>
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/65">
          {SYSTEM_NAME_BITS}
        </span>
      </div>
    );
  }

  if (variant === 'login-hero') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="inline-block rounded-xl bg-white px-4 py-2.5 shadow-lg ring-1 ring-white/20">
          <LogoMark className="h-10" />
        </div>
        <SystemWordmark tone="inverted" size="lg" />
      </div>
    );
  }

  if (variant === 'login-compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <LogoMark className="h-9" />
        <SystemWordmark tone="light" size="sm" />
      </div>
    );
  }

  /* loader */
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <LogoMark className="h-10 opacity-90" />
      <SystemWordmark tone="light" className="items-center text-center" />
    </div>
  );
}

export { SYSTEM_NAME };
