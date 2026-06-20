import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, FileImage, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { documentsApi } from '@/api/documents';
import { getErrorMessage } from '@/api/client';
import { isPdfFilename } from '@/utils/documentDisplay';
import type { DocumentAttachment } from '@/types/document';

interface SupportingAttachmentPreviewDialogProps {
  documentId: string;
  attachment: DocumentAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportingAttachmentPreviewDialog({
  documentId,
  attachment,
  open,
  onOpenChange,
}: SupportingAttachmentPreviewDialogProps) {
  const filename = attachment?.filename ?? 'Attachment';
  const isPdf = isPdfFilename(filename) || attachment?.mime_type === 'application/pdf';
  const isImage = Boolean(attachment?.mime_type?.startsWith('image/'));
  const isDocx =
    attachment?.mime_type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename.toLowerCase().endsWith('.docx');
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [docxError, setDocxError] = useState<string>('');
  const [docxLoading, setDocxLoading] = useState(false);

  const { data: blob, isLoading, isError, error } = useQuery({
    queryKey: ['document-attachment-preview', documentId, attachment?.id],
    queryFn: () => documentsApi.downloadAttachmentBlob(documentId, attachment!.id),
    enabled: open && !!documentId && !!attachment?.id,
    staleTime: 60_000,
  });

  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    let cancelled = false;

    async function renderDocx() {
      if (!open || !blob || !isDocx) {
        setDocxHtml('');
        setDocxError('');
        setDocxLoading(false);
        return;
      }

      setDocxLoading(true);
      setDocxError('');
      try {
        const mammoth = await import('mammoth/mammoth.browser');
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) {
          setDocxHtml(result.value || '<p>No previewable text was found in this Word document.</p>');
        }
      } catch (err) {
        if (!cancelled) {
          setDocxError(err instanceof Error ? err.message : 'Could not preview this Word document.');
          setDocxHtml('');
        }
      } finally {
        if (!cancelled) setDocxLoading(false);
      }
    }

    void renderDocx();
    return () => {
      cancelled = true;
    };
  }, [blob, isDocx, open]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(100vw-2rem,56rem)] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pb-3 pt-6">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{filename}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              {isImage ? <FileImage className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
              Supporting document
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!blob || isLoading}
              onClick={download}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          {(isLoading || docxLoading) && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading preview…
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive py-4">{getErrorMessage(error)}</p>
          )}

          {!isLoading && !isError && !docxLoading && blob && isPdf && objectUrl && (
            <iframe
              title={`Preview: ${filename}`}
              src={objectUrl}
              className="w-full min-h-[480px] h-[70vh] max-h-[900px] rounded-md border border-border bg-background"
            />
          )}

          {!isLoading && !isError && !docxLoading && blob && isImage && objectUrl && (
            <div className="flex justify-center rounded-md border border-border bg-background p-4">
              <img
                src={objectUrl}
                alt={filename}
                className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
              />
            </div>
          )}

          {!isLoading && !isError && !docxLoading && blob && isDocx && docxHtml && (
            <div className="rounded-md border border-border bg-background px-5 py-4">
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            </div>
          )}

          {!isLoading && !isError && !docxLoading && docxError && (
            <p className="text-sm text-destructive py-2">{docxError}</p>
          )}

          {!isLoading && !isError && !docxLoading && blob && !isPdf && !isImage && !isDocx && (
            <p className="text-sm text-muted-foreground py-2">
              In-browser preview is available for PDF, image, and Word documents. Use Download to
              open this file on your device.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
