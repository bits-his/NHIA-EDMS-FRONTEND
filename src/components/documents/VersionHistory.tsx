import { GitCommit, Clock } from 'lucide-react';
import { formatDateTime } from '@/utils/formatters';
import type { DocumentVersion } from '@/types/document';
import { Skeleton } from '@/components/shared/Skeleton';
import { cn } from '@/utils/cn';

interface VersionHistoryProps {
  versions: DocumentVersion[];
  loading?: boolean;
}

export function VersionHistory({ versions, loading }: VersionHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="space-y-2 flex-1 pt-0.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No versions found.</p>;
  }

  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);

  return (
    <div className="relative pl-3">
      {/* Vertical line */}
      <div className="absolute left-3 top-3.5 bottom-3.5 w-px bg-border" />

      <div className="space-y-0">
        {sorted.map((version, idx) => {
          const isCurrent = idx === 0;
          return (
            <div key={version.id} className="flex gap-4 relative pb-5 last:pb-0">
              {/* Node */}
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 z-10 -ml-3',
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background text-muted-foreground'
              )}>
                <GitCommit className="h-3 w-3" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-semibold', isCurrent ? 'text-primary' : 'text-foreground')}>
                      Version {version.version_number}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(version.created_at)}
                  </div>
                </div>
                {version.content ? (
                  <div
                    className="prose prose-xs max-w-none text-muted-foreground bg-muted/60 rounded-lg p-3 leading-relaxed line-clamp-3 border border-border/50 [&_*]:text-xs"
                    dangerouslySetInnerHTML={{ __html: version.content }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">No content snapshot</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
