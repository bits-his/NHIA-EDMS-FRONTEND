import { useState, useCallback, type FormEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search as SearchIcon, Upload, FileText, Scan, X,
  ExternalLink, AlertCircle, CheckCircle2, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { searchApi } from '@/api/search';
import { getErrorMessage } from '@/api/client';
import { OCR_ACCEPTED_TYPES, MAX_OCR_FILE_SIZE } from '@/utils/constants';
import { formatBytes, truncate } from '@/utils/formatters';
import type { SearchResponse, OcrResponse } from '@/types/search';
import type { DocumentStatus } from '@/types/document';
import { cn } from '@/utils/cn';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const searchMutation = useMutation({
    mutationFn: () => searchApi.search({ query, size: 20, from: 0 }),
    onSuccess: (data) => setSearchResults(data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const ocrMutation = useMutation({
    mutationFn: (file: File) => searchApi.ocr(file),
    onSuccess: (data) => { setOcrResult(data); toast.success('Text extracted successfully'); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) { setUploadedFile(file); setOcrResult(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: OCR_ACCEPTED_TYPES,
    maxSize: MAX_OCR_FILE_SIZE,
    maxFiles: 1,
  });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search & OCR"
        description="Full-text search across documents and extract text from uploaded files"
      />

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search"><SearchIcon className="h-3.5 w-3.5" /> Full-Text Search</TabsTrigger>
          <TabsTrigger value="ocr"><Scan className="h-3.5 w-3.5" /> OCR Extraction</TabsTrigger>
        </TabsList>

        {/* ── Search tab ── */}
        <TabsContent value="search" className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search documents by title or content…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" loading={searchMutation.isPending} disabled={!query.trim()}>
              Search
            </Button>
          </form>

          {searchMutation.isPending ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : searchResults ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} for "<span className="font-medium text-foreground">{query}</span>"
              </p>
              {searchResults.hits.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                    <SearchIcon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-foreground">No documents found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try different search terms or check if documents are indexed</p>
                </div>
              ) : (
                searchResults.hits.map((hit) => (
                  <div
                    key={hit.id}
                    className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/25 hover:shadow-card cursor-pointer transition-all group"
                    onClick={() => navigate(`/documents/${hit.id}`)}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 group-hover:bg-primary/15 transition-colors mt-0.5">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{hit.title}</p>
                        {hit.content && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {truncate(hit.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), 150)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {hit.status && <DocumentStatusBadge status={hit.status as DocumentStatus} size="sm" />}
                          <span className="text-xs text-muted-foreground">Score: {hit.score.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0 mt-1 transition-colors" />
                  </div>
                ))
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* ── OCR tab ── */}
        <TabsContent value="ocr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload File for Text Extraction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/20'
                )}
              >
                <input {...getInputProps()} />
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl mb-3 transition-colors',
                  isDragActive ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <Upload className={cn('h-6 w-6', isDragActive ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.5} />
                </div>
                {isDragActive ? (
                  <p className="text-sm font-semibold text-primary">Drop the file here</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Drag & drop a file, or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1.5">PDF, PNG, JPEG, TIFF, BMP — max 50 MB</p>
                  </>
                )}
              </div>

              {/* Rejection errors */}
              {fileRejections.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/8 border border-destructive/20 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{fileRejections[0].errors.map((e) => <p key={e.code}>{e.message}</p>)}</div>
                </div>
              )}

              {/* Selected file */}
              {uploadedFile && (
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(uploadedFile.size)} · {uploadedFile.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" onClick={() => ocrMutation.mutate(uploadedFile)} loading={ocrMutation.isPending}>
                      <Scan className="h-4 w-4" /> Extract Text
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => { setUploadedFile(null); setOcrResult(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OCR loading */}
          {ocrMutation.isPending && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          )}

          {/* OCR result */}
          {ocrResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Extracted Text
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{ocrResult.filename}</span>
                </div>
              </CardHeader>
              <CardContent>
                {ocrResult.text ? (
                  <div className="space-y-3">
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 border border-border/50 rounded-lg p-4 max-h-96 overflow-y-auto text-foreground leading-relaxed">
                      {ocrResult.text}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(ocrResult.text);
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Text
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center py-8">
                    No text could be extracted from this file.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
