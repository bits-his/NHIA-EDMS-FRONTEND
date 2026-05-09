import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  badge,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn('border-border/80 shadow-sm overflow-hidden', className)}>
      <CardHeader className="cursor-pointer select-none py-4 px-5 bg-muted/30 border-b border-border/60">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight flex flex-wrap items-center gap-2">
              {title}
              {badge}
            </CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-1 font-normal">{subtitle}</p>}
          </div>
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </button>
      </CardHeader>
      {open && <CardContent className="p-5 pt-5 space-y-4">{children}</CardContent>}
    </Card>
  );
}
