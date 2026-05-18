import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, X } from 'lucide-react';
import { documentsApi } from '@/api/documents';
import type { Document } from '@/types/document';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/shared/Skeleton';

const MAX_RESULTS = 8;
const MIN_QUERY = 2;

function looksLikeRef(q: string): boolean {
  return /NHIA\//i.test(q) || /^[A-Z]{2,}-/i.test(q);
}

function docPrimary(d: Document): string {
  return d.title?.trim() || 'Untitled document';
}

function docMeta(d: Document): string {
  return [
    d.ref_number?.trim() ? `Ref ${d.ref_number.trim()}` : null,
    d.department?.trim() || null,
    d.category?.replace(/_/g, ' ') || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

interface AuditDocumentPickerProps {
  value: string;
  selectedDoc?: Document | null;
  onChange: (documentId: string, doc?: Document) => void;
  className?: string;
}

export function AuditDocumentPicker({
  value,
  selectedDoc,
  onChange,
  className,
}: AuditDocumentPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searchFilters = useMemo(() => {
    if (debounced.length < MIN_QUERY) return null;
    if (looksLikeRef(debounced)) return { ref_number: debounced };
    return { keyword: debounced };
  }, [debounced]);

  const { data: results, isFetching } = useQuery({
    queryKey: ['audit-document-picker', searchFilters],
    queryFn: () => documentsApi.search(searchFilters!),
    enabled: Boolean(searchFilters),
    staleTime: 20_000,
  });

  const selected =
    selectedDoc ?? (value && results?.find((d) => d.id === value)) ?? null;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (d: Document) => {
    onChange(d.id, d);
    setQuery('');
    setOpen(false);
  };

  const suggestions = (results ?? []).slice(0, MAX_RESULTS);

  return (
    <div ref={rootRef} className={cn('space-y-2', className)}>
      {selected ? (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground leading-snug">{docPrimary(selected)}</p>
              {docMeta(selected) && (
                <p className="text-xs text-muted-foreground mt-0.5">{docMeta(selected)}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.status && (
                  <Badge variant="outline" className="text-[10px] font-normal capitalize">
                    {selected.status.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Clear"
              onClick={() => onChange('', undefined)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by reference (e.g. NHIA/FIN/2026/00002) or document title…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="pl-9"
            autoComplete="off"
          />
          {open && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {debounced.length < MIN_QUERY ? (
                <p className="px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                  Enter at least {MIN_QUERY} characters — reference number or title.
                </p>
              ) : isFetching ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : suggestions.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">No documents match your search.</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto py-1">
                  {suggestions.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-muted/80 transition-colors"
                        onClick={() => pick(d)}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{docPrimary(d)}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{docMeta(d) || '—'}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
