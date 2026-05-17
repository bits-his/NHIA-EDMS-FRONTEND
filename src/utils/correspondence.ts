import type { CorrespondenceDirection, Document } from '@/types/document';

export function correspondenceDirectionLabel(
  direction: CorrespondenceDirection | null | undefined
): string {
  if (direction === 'incoming') return 'Incoming';
  if (direction === 'outgoing') return 'Outgoing';
  return '—';
}

/** Primary registry identifier shown in lists (tracking ID for correspondence, else ref). */
export function documentRegistryId(doc: Pick<Document, 'tracking_id' | 'ref_number'>): string | null {
  const tracking = doc.tracking_id?.trim();
  if (tracking) return tracking;
  const ref = doc.ref_number?.trim();
  return ref || null;
}
