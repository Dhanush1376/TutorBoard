/**
 * Canonical email form used for every lookup, uniqueness check and write:
 * trimmed, Unicode-normalised, lower-cased. (Provider-specific rewrites such as
 * dropping Gmail dots are deliberately NOT applied: they are not true for every
 * domain and would merge distinct mailboxes.)
 */
export function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.normalize('NFKC').trim().toLowerCase();
}

/** The account shape every auth endpoint returns. Never includes secrets. */
export function publicUser(user) {
  if (!user) return null;
  const u = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: u._id?.toString?.() ?? u.id,
    name: u.name,
    email: u.email,
    emailVerified: !!u.emailVerifiedAt,
    role: u.role || 'user',
    settings: u.settings || {},
    apiPreferences: u.apiPreferences || {},
    googleId: u.googleId ? true : undefined,
    githubId: u.githubId ? true : undefined,
    hasPassword: u.password !== undefined ? !!u.password : undefined,
    avatar: u.avatar,
  };
}

export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'superadmin';
}
