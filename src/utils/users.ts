/**
 * Known user ID → username mapping from seed data.
 * The backend has no "get user by ID" endpoint, so we maintain this
 * client-side map for display purposes.
 * This is extended at runtime when new users are fetched via listUsers().
 */
export const KNOWN_USERS: Record<string, string> = {
  'a0000001-0000-0000-0000-000000000001': 'alice',
  'b0000002-0000-0000-0000-000000000002': 'bob',
  'c0000003-0000-0000-0000-000000000003': 'charlie',
  '20000001-0000-4000-8000-000000000001': 'nhia_officer',
  '20000001-0000-4000-8000-000000000002': 'nhia_so',
  '20000001-0000-4000-8000-000000000003': 'nhia_am',
  '20000001-0000-4000-8000-000000000004': 'nhia_mgr',
  '20000001-0000-4000-8000-000000000005': 'nhia_sm',
  '20000001-0000-4000-8000-000000000006': 'nhia_pm',
  '20000001-0000-4000-8000-000000000007': 'nhia_agm',
  '20000001-0000-4000-8000-000000000008': 'nhia_dgm',
  '20000001-0000-4000-8000-000000000009': 'nhia_gm',
  '20000001-0000-4000-8000-000000000010': 'nhia_es',
};

/**
 * Register additional users discovered at runtime (e.g. from GET /auth/users).
 */
export function registerUsers(users: { id: string; username: string }[]) {
  users.forEach((u) => { KNOWN_USERS[u.id] = u.username; });
}

/**
 * Resolve a user UUID to a display name.
 * Returns the known username if available, otherwise a shortened UUID.
 */
export function resolveUsername(userId: string | null | undefined): string {
  if (!userId) return 'System';
  return KNOWN_USERS[userId] ?? userId.slice(0, 8) + '…';
}

/**
 * Get initials for a username or UUID.
 */
export function getInitials(usernameOrId: string): string {
  const name = KNOWN_USERS[usernameOrId] ?? usernameOrId;
  return name.slice(0, 2).toUpperCase();
}
