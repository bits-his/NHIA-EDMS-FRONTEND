import { useNavigate } from 'react-router-dom';
import { FileText, Clock, User, ArrowRight } from 'lucide-react';
import { DocumentStatusBadge } from './StatusBadge';
import { Badge } from '@/components/ui/badge';
import { formatRelative, truncate } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { cn } from '@/utils/cn';
import type { Document } from '@/types/document';

const CATEGORY_LABEL: Record<string, string> = {
  internal_memo: 'Internal',
  external_correspondence: 'External',
};

interface DocumentCardProps {
  document: Document;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const navigate = useNavigate();
  const isPending = document.status === 'pending';

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card cursor-pointer',
        'transition-all duration-200 hover:shadow-card-md hover:-translate-y-0.5',
        isPending
          ? 'border-amber-200 dark:border-amber-800/60'
          : 'border-border hover:border-primary/25'
      )}
      onClick={() => navigate(`/documents/${document.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/documents/${document.id}`)}
    >
      {isPending && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-amber-400" />
      )}

      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
              isPending ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-primary/8 group-hover:bg-primary/15'
            )}>
              <FileText className={cn('h-4 w-4', isPending ? 'text-amber-600 dark:text-amber-400' : 'text-primary')} />
            </div>
            <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors leading-snug">
              {document.title}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <DocumentStatusBadge status={document.status} size="sm" />
            <div className="flex flex-wrap gap-1 justify-end">
              {document.ref_number && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono font-normal">
                  {document.ref_number}
                </Badge>
              )}
              {document.category && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                  {CATEGORY_LABEL[document.category] ?? document.category}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {document.content ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
            {truncate(document.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), 130)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic mb-4">No content</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
        <div className="flex items-center gap-2">
          <User className="h-3 w-3" />
          <span className="capitalize">{resolveUsername(document.owner_id)}</span>
          <span className="text-muted-foreground/30">·</span>
          <Clock className="h-3 w-3" />
          <span>{formatRelative(document.updated_at)}</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
      </div>
    </div>
  );
}
