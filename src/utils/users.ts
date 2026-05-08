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
