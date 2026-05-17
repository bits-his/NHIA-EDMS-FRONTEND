import { NHIA_LOGO_SRC } from '@/constants/brandAssets';
import { cn } from '@/utils/cn';

/** Strip catalogue suffix “ Template” for letterhead (word “Template” is not shown there). */
export function letterheadDocTypeDisplay(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  const stripped = raw.replace(/\s+Template$/i, '').trim();
  return stripped || '';
}

/** “South West Zone” → “SOUTH-WEST”; “Lagos Zone” → “LAGOS”. */
export function letterheadZoneSegment(zoneCatalogueName: string): string {
  const base = zoneCatalogueName.replace(/\s+Zone$/i, '').trim();
  return base.toUpperCase().replace(/\s+/g, '-');
}

/**
 * Zone on the first line (no brackets); state on the second line under the zone.
 * Returns null when neither zone nor state should be shown (use HQ fallback).
 */
export function buildLetterheadLocationParts(
  zoneCode: string | undefined,
  zones: { code: string; name: string }[] | undefined,
  stateOfficeName: string | undefined
): { zoneLine?: string; stateLine?: string } | null {
  const code = zoneCode?.trim();
  const state =
    stateOfficeName?.trim() && stateOfficeName.trim().toLowerCase() !== 'all'
      ? stateOfficeName.trim()
      : '';

  const zoneMeta = code && zones?.length ? zones.find((z) => z.code === code) : undefined;
  const zoneSeg = zoneMeta
    ? letterheadZoneSegment(zoneMeta.name)
    : code && code.toLowerCase() !== 'all'
      ? code.toUpperCase()
      : '';

  const zoneLine = zoneSeg ? `${zoneSeg} ZONAL OFFICE` : undefined;
  const stateLine = state ? `${state} State` : undefined;

  if (!zoneLine && !stateLine) return null;
  return { zoneLine, stateLine };
}

export interface NhiaMemoLetterheadProps {
  /** Catalogue label (e.g. “Internal Memo Template”); trailing “Template” is omitted on the letterhead. */
  documentTypeLabel?: string;
  /** Zone code from org reference (e.g. SW); paired with `zones` for display. */
  zoneCode?: string;
  /** State office name (e.g. Oyo). */
  stateOfficeName?: string;
  /** Lookup list from GET /documents/reference/org-scope — same order as template scope selectors. */
  zones?: { code: string; name: string }[];
  className?: string;
}

const FALLBACK_HQ_ADDRESS =
  'Plot 297, Herbert Macaulay Way, Central Business District, Abuja';

/** Matches the letterhead block above the CKEditor in `MemoEditor` — keep markup/classes in sync. */
export function NhiaMemoLetterhead({
  documentTypeLabel,
  zoneCode,
  stateOfficeName,
  zones,
  className,
}: NhiaMemoLetterheadProps) {
  const headingLine = letterheadDocTypeDisplay(documentTypeLabel) || 'Internal Memorandum';
  const locationParts = buildLetterheadLocationParts(zoneCode, zones, stateOfficeName);

  return (
    <div className={cn('bg-white border-b px-8 py-6 text-center', className)}>
      <div className="flex items-center justify-center gap-5 sm:gap-6 mb-3">
        <img
          src={NHIA_LOGO_SRC}
          alt="NHIA"
          className="h-20 w-30  object-contain shrink-0"
        />
        {/* <div className="text-left min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Federal Republic of Nigeria
          </p>
          <h1 className="text-lg font-bold text-green-800 leading-tight">
            National Health Insurance Authority
          </h1>
          {locationParts?.zoneLine ? (
            <p className="text-xs text-gray-600 leading-snug mt-0.5 font-medium uppercase tracking-wide">
              {locationParts.zoneLine}
            </p>
          ) : null}
          {!locationParts ? <p className="text-xs text-gray-600">{FALLBACK_HQ_ADDRESS}</p> : null}
        </div> */}
      </div>
      {locationParts?.stateLine ? (
        <p className="text-center text-xs text-gray-600 mt-1">{locationParts.stateLine}</p>
      ) : null}
      <div className="border-t-4 border-green-700 mt-2 pt-2">
        <p className="text-sm font-bold uppercase tracking-widest text-gray-700">{headingLine}</p>
      </div>
    </div>
  );
}
