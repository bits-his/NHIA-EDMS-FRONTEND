import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/utils/cn';
import { formatTemplatePreviewHtml } from '@/components/template-builder/formatTemplatePreviewHtml';
import { NhiaMemoLetterhead } from '@/components/documents/NhiaMemoLetterhead';
import { documentsApi } from '@/api/documents';
import { QUERY_KEYS } from '@/utils/constants';

interface TemplatePreviewPanelProps {
  templateName: string;
  templateCode: string;
  docTypeLabel: string;
  scopeLabel: string;
  html: string;
  /** Zone code + state office for letterhead address line (optional). */
  zoneCode?: string;
  stateOfficeName?: string;
  className?: string;
  /** Wider scroll area and no sticky positioning — use inside dialogs. */
  variant?: 'default' | 'embedded';
}

const EMPTY_PREVIEW =
  '<p class="text-muted-foreground text-sm">Template body will render here with placeholders substituted at generation time.</p>';

export function TemplatePreviewPanel({
  templateName,
  templateCode,
  docTypeLabel,
  scopeLabel,
  html,
  zoneCode,
  stateOfficeName,
  className,
  variant = 'default',
}: TemplatePreviewPanelProps) {
  const formattedHtml = useMemo(() => formatTemplatePreviewHtml(html), [html]);
  const displayHtml = formattedHtml.trim() ? formattedHtml : EMPTY_PREVIEW;

  const { data: orgScope } = useQuery({
    queryKey: QUERY_KEYS.orgScopeReference,
    queryFn: () => documentsApi.getOrgScopeReference(),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <Card
      className={cn(
        'border-primary/20 shadow-md',
        variant === 'default' && 'lg:sticky lg:top-4',
        className
      )}
    >
      <CardHeader className="pb-3 px-4 pt-4 border-b border-border/60 bg-muted/30">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Live template preview
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="outline" className="text-[10px] font-normal">
            Letterhead
          </Badge>
          <Badge variant="outline" className="text-[10px] font-normal">
            Metadata
          </Badge>
          <Badge variant="outline" className="text-[10px] font-normal">
            Approvals
          </Badge>
          <Badge variant="outline" className="text-[10px] font-normal">
            Signatures
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 py-3 space-y-2 border-b border-border/60 bg-background">
          <p className="text-xs font-semibold truncate">{templateName || 'Untitled template'}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span>
              Code: <span className="font-mono text-foreground">{templateCode || '—'}</span>
            </span>
            <span>Type: {docTypeLabel}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Scope: <span className="text-foreground">{scopeLabel}</span>
          </p>
        </div>
        <ScrollArea
          className={cn(
            variant === 'embedded' ? 'h-[min(70vh,640px)]' : 'h-[min(52vh,520px)]'
          )}
        >
          <div className="p-3 sm:p-4 bg-slate-100/90 dark:bg-slate-900/45">
            <div className="mx-auto max-w-[210mm] border rounded-lg bg-white shadow-sm overflow-hidden">
              <NhiaMemoLetterhead
                documentTypeLabel={docTypeLabel}
                zoneCode={zoneCode}
                stateOfficeName={stateOfficeName}
                zones={orgScope?.zones}
              />

              <div
                className="prose prose-sm max-w-none px-8 py-4 bg-white text-gray-900 min-h-[200px] [&_.nhia-preview-sig]:max-w-full [&_strong]:text-gray-900"
                dangerouslySetInnerHTML={{ __html: displayHtml }}
              />
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
