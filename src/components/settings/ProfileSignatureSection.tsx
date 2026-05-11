import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PenLine, Upload, Eraser, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authApi } from '@/api/auth';
import { documentsApi } from '@/api/documents';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';

const PAD_W = 400;
const PAD_H = 140;

export function ProfileSignatureSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: QUERY_KEYS.userProfile(userId),
    queryFn: () => authApi.getProfile(userId),
    enabled: !!userId,
  });

  const sigBlobQuery = useQuery({
    queryKey: QUERY_KEYS.userSignatureBlob(userId),
    queryFn: async () => {
      try {
        return await documentsApi.getMySignatureBlob();
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: !!userId && !!profile?.signature_path,
  });

  useEffect(() => {
    if (!sigBlobQuery.data) {
      setObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(sigBlobQuery.data);
    setObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [sigBlobQuery.data]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = PAD_W * dpr;
    canvas.height = PAD_H * dpr;
    canvas.style.width = `${PAD_W}px`;
    canvas.style.height = `${PAD_H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAD_W, PAD_H);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
  }, []);

  const pos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      drawing.current = true;
      last.current = pos(e);
    },
    [pos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = ctxRef.current;
      const p = pos(e);
      const prev = last.current;
      if (!ctx || !prev) return;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
    },
    [pos]
  );

  const endDraw = useCallback(() => {
    drawing.current = false;
    last.current = null;
  }, []);

  const clearPad = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAD_W, PAD_H);
    ctx.strokeStyle = '#111827';
  }, []);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.uploadProfileSignature(file),
    onSuccess: () => {
      toast.success('Signature saved. It will be used for official memo previews after final approval when you are a registered signatory.');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userProfile(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSignatureBlob(userId) });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Could not read signature from pad');
          return;
        }
        uploadMutation.mutate(new File([blob], 'signature.png', { type: 'image/png' }));
      },
      'image/png',
      0.92
    );
  }, [uploadMutation]);

  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      if (!/^image\/(png|jpeg|jpg|gif|webp)$/i.test(f.type)) {
        toast.error('Please choose a PNG, JPEG, GIF, or WebP image');
        return;
      }
      uploadMutation.mutate(f);
    },
    [uploadMutation]
  );

  const busy = uploadMutation.isPending || profileLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4" /> E-signature
        </CardTitle>
        <CardDescription>
          Upload an image of your signature or draw it below. This is stored on your profile and synced to your
          signatory record when one exists, for use on internal memos after final approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current file</p>
            <div className="flex h-[100px] w-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
              {sigBlobQuery.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : objectUrl ? (
                <img src={objectUrl} alt="Saved signature" className="max-h-full max-w-full object-contain p-1" />
              ) : profile?.signature_path ? (
                <span className="text-xs text-muted-foreground px-2 text-center">Preview unavailable</span>
              ) : (
                <span className="text-xs text-muted-foreground px-2 text-center">No signature on file yet</span>
              )}
            </div>
            {profile?.signature_path && (
              <p className="text-[10px] text-muted-foreground font-mono break-all max-w-[220px]">
                {profile.signature_path}
              </p>
            )}
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upload image</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> Choose image…
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Or draw here</p>
          <div className="rounded-lg border border-border bg-white overflow-hidden inline-block touch-none">
            <canvas
              ref={canvasRef}
              className="block cursor-crosshair max-w-full"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearPad} disabled={busy}>
              <Eraser className="h-4 w-4" /> Clear pad
            </Button>
            <Button type="button" size="sm" onClick={saveCanvas} disabled={busy} loading={uploadMutation.isPending}>
              <Save className="h-4 w-4" /> Save drawn signature
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
