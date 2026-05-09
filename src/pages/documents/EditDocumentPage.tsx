import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import MemoEditor from '@/components/documents/MemoEditor';
import { documentsApi } from '@/api/documents';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { isUuid } from '@/utils/uuid';

const editSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Max 500 characters'),
  content: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function EditDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const documentIdValid = !!id && isUuid(id);

  const { data: document, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.document(id!),
    queryFn: () => documentsApi.getById(id!),
    enabled: documentIdValid,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (document) reset({ title: document.title, content: document.content ?? '' });
  }, [document, reset]);

  const content = watch('content');

  const mutation = useMutation({
    mutationFn: (data: EditForm) => documentsApi.update(id!, data),
    onSuccess: () => {
      toast.success('Document updated successfully');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(id!) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentVersions(id!) });
      navigate(`/documents/${id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!documentIdValid) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4" /> Documents
        </Button>
        <ErrorState
          title="Invalid document link"
          error={
            new Error(
              'This URL is not a valid document id. Use Documents in the sidebar to open a document.'
            )
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/documents/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <ErrorState error={error} />
      </div>
    );
  }

  if (document && document.status !== 'draft') {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/documents/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This document is in <strong>{document.status}</strong> status and cannot be edited. Only draft documents can be modified.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/documents/${id}`)} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Back to Document
      </Button>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Edit Document</h1>
          <p className="text-sm text-muted-foreground mt-1">Modify the document title and content</p>
        </div>
        {document && <DocumentStatusBadge status={document.status} />}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Document Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input id="title" placeholder="Document title" error={!!errors.title} {...register('title')} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Content</Label>
                <MemoEditor
                  value={content ?? ''}
                  onChange={(val) => setValue('content', val, { shouldDirty: true })}
                />
                <p className="text-xs text-muted-foreground">Changing the content will create a new version automatically.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(`/documents/${id}`)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>Save Changes</Button>
          </div>
        </form>
      )}
    </div>
  );
}
