import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { documentsApi } from '@/api/documents';
import { getErrorMessage } from '@/api/client';
import { isPdfFilename } from '@/utils/documentDisplay';

interface ExternalPrimaryFileViewerProps {
  documentId: string;
  filename: string;
}

export function ExternalPrimaryFileViewer({ documentId, filename }: ExternalPrimaryFileViewerProps) {
  const isPdf = isPdfFilename(filename);

  const { data: blob, isLoading, isError, error } = useQuery({
    queryKey: ['document-primary-file', documentId],
    queryFn: () => documentsApi.downloadPrimaryFileBlob(documentId),
    enabled: !!documentId,
    staleTime: 60_000,
  });

  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium truncate">{filename}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!blob || isLoading}
          onClick={download}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading file…
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive py-4">{getErrorMessage(error)}</p>
      )}

      {!isLoading && !isError && blob && isPdf && objectUrl && (
        <iframe
          title={`Preview: ${filename}`}
          src={objectUrl}
          className="w-full min-h-[480px] h-[70vh] max-h-[900px] rounded-md border border-border bg-background"
        />
      )}

      {!isLoading && !isError && blob && !isPdf && (
        <p className="text-sm text-muted-foreground py-2">
          In-browser preview is available for PDF files. Use Download to open this Word document on
          your device.
        </p>
      )}
    </div>
  );
}
