import type { UserRecord } from '@/api/auth';
import type { Role } from '@/types/auth';
import type { RecipientType } from '@/types/document';

/** Human label for a grade / RBAC role (same idea as Users admin). */
export function roleDisplayLabel(role: Pick<Role, 'name' | 'description'>): string {
  const d = role.description?.trim();
  if (d) return d;
  return role.name.replace(/_/g, ' ');
}

/** Grade ladder roles — `level` from auth API; high → low. */
export function gradeRolesSorted(all: Role[] | undefined): Role[] {
  if (!all?.length) return [];
  return [...all]
    .filter((r) => r.level != null && typeof r.level === 'number')
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
}

export function normRank(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

export function userMatchesGradeRole(u: UserRecord, role: Role): boolean {
  const ur = normRank(u.rank);
  if (!ur) return false;
  const desc = normRank(role.description);
  const nameHuman = normRank(role.name.replace(/_/g, ' '));
  const nameRaw = normRank(role.name);
  return ur === desc || ur === nameHuman || ur === nameRaw;
}

/** True when the user's assigned RBAC role is this catalogue role (covers empty profile `rank`). */
export function userHasAssignedRole(u: UserRecord, role: Role): boolean {
  return (u.roles ?? []).some((ur) => ur.id === role.id || normRank(ur.name) === normRank(role.name));
}

export function userMatchesGradeOrAssignment(u: UserRecord, role: Role): boolean {
  return userMatchesGradeRole(u, role) || userHasAssignedRole(u, role);
}

export function roleOptionValue(def: Pick<Role, 'name' | 'description'>): string {
  return def.description?.trim() || roleDisplayLabel(def);
}

export function userMatchesRankFilter(
  u: UserRecord,
  rankFilter: string,
  catalogue: Role[] | undefined
): boolean {
  if (!rankFilter.trim()) return true;
  const target = normRank(rankFilter);
  if (normRank(u.rank) === target) return true;
  for (const ar of u.roles ?? []) {
    const def = catalogue?.find((x) => x.id === ar.id) ?? ar;
    const v = roleOptionValue(def);
    if (normRank(v) === target) return true;
    if (normRank(roleDisplayLabel(def)) === target) return true;
    if (normRank(ar.name) === target) return true;
    if (normRank(ar.name.replace(/_/g, ' ')) === target) return true;
  }
  return false;
}

export type RankFilterOption = { value: string; label: string };

/** Rank options: grade ladder (profile rank OR assigned role), then profile-only ranks, then other assigned roles. */
export function buildRankFilterOptions(
  users: UserRecord[],
  roles: Role[] | undefined
): RankFilterOption[] {
  const graded = gradeRolesSorted(roles);
  const seenNorm = new Set<string>();
  const ordered: RankFilterOption[] = [];

  for (const r of graded) {
    const value = roleOptionValue(r);
    const key = normRank(value);
    if (seenNorm.has(key)) continue;
    if (!users.some((u) => userMatchesGradeOrAssignment(u, r))) continue;
    seenNorm.add(key);
    ordered.push({ value, label: roleDisplayLabel(r) });
  }

  const extras: RankFilterOption[] = [];
  for (const u of users) {
    const rr = u.rank?.trim();
    if (!rr) continue;
    const key = normRank(rr);
    if (seenNorm.has(key)) continue;
    seenNorm.add(key);
    extras.push({ value: rr, label: rr });
  }
  extras.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const gradedIds = new Set(graded.map((r) => r.id));
  /** Assigned roles not already listed (e.g. submitter/admin with no `level` in catalogue). */
  const fromAssignments: RankFilterOption[] = [];
  for (const u of users) {
    for (const ar of u.roles ?? []) {
      if (ar.id && gradedIds.has(ar.id)) continue;
      const def = roles?.find((x) => x.id === ar.id) ?? ar;
      const value = roleOptionValue(def);
      const key = normRank(value);
      if (seenNorm.has(key)) continue;
      seenNorm.add(key);
      fromAssignments.push({ value, label: roleDisplayLabel(def) });
    }
  }
  fromAssignments.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return [...ordered, ...extras, ...fromAssignments];
}

export const RECIPIENT_TYPE_ORDER: RecipientType[] = ['to', 'cc', 'bcc'];

export const RECIPIENT_TYPE_LABEL: Record<RecipientType, string> = {
  to: 'To',
  cc: 'CC',
  bcc: 'BCC',
};

/** Normalize DB / API recipient_type values for grouping. */
export function normalizeRecipientType(value: RecipientType | string | null | undefined): RecipientType | null {
  const t = String(value ?? 'to').toLowerCase();
  if (t === 'to' || t === 'cc' || t === 'bcc') return t;
  return null;
}

export function groupDocumentRecipientsByType<T extends { user_id: string; recipient_type?: RecipientType | string }>(
  recipients: T[] | undefined
): Record<RecipientType, T[]> {
  const grouped: Record<RecipientType, T[]> = { to: [], cc: [], bcc: [] };
  for (const row of recipients ?? []) {
    const type = normalizeRecipientType(row.recipient_type);
    if (type) grouped[type].push(row);
  }
  return grouped;
}

/**
 * True when the user is tagged only as CC and/or BCC (no To row) on this document.
 */
export function isReadOnlyDocumentRecipient(
  recipients: { user_id: string; recipient_type?: RecipientType | string }[] | undefined,
  userId: string | undefined | null
): boolean {
  if (!userId?.trim() || !recipients?.length) return false;
  const mine = recipients.filter((r) => r.user_id === userId);
  if (!mine.length) return false;
  return !mine.some((r) => String(r.recipient_type ?? 'to').toLowerCase() === 'to');
}

export function recipientUserLabel(u: UserRecord, roleCatalogue: Role[] | undefined): string {
  const name = u.full_name?.trim() || u.username;
  let rank = u.rank?.trim();
  if (!rank && u.roles?.length) {
    rank = u.roles
      .map((ar) => roleDisplayLabel(roleCatalogue?.find((x) => x.id === ar.id) ?? ar))
      .join(', ');
  }
  if (!rank) rank = '—';
  const dept = u.department?.trim() || '—';
  return `${name} — ${rank}, ${dept}`;
}
