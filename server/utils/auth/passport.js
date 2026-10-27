import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../../models/User.js';
import { normalizeEmail } from './identity.js';
import { OAuthStateStore } from './oauthStateStore.js';

/**
 * OAuth sign-in and account linking.
 *
 * Linking policy (prevents account takeover through a shared email address):
 *  - A provider identity is matched first by its stable subject id
 *    (googleId / githubId), never by email.
 *  - A new provider identity is attached to an existing account by email ONLY
 *    when the provider asserts the email is verified AND the existing account
 *    has itself proven ownership of that email (emailVerifiedAt). Otherwise the
 *    user must sign in with their existing method and link from Settings.
 *  - Without a provider-verified email no account is created or linked.
 *  - In link mode (started by a signed-in user) the identity is attached to
 *    that user, unless another account already owns it.
 */

export class OAuthLinkError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const FIELD = { google: 'googleId', github: 'githubId' };

function cleanName(name, email) {
  const n = String(name || '').replace(/[<>]/g, '').trim().slice(0, 50);
  if (n.length >= 2) return n;
  const local = String(email || '').split('@')[0].slice(0, 50);
  return local.length >= 2 ? local : 'TutorBoard learner';
}

/** Attach `providerId` to `userId` unless another account owns it. */
async function linkIdentity(userId, provider, providerId, avatar) {
  const field = FIELD[provider];
  try {
    const user = await User.findOneAndUpdate(
      { _id: userId, $or: [{ [field]: null }, { [field]: { $exists: false } }, { [field]: providerId }] },
      { $set: { [field]: providerId } },
      { returnDocument: 'after' }
    );
    if (!user) throw new OAuthLinkError('provider_already_linked');
    if (!user.avatar && avatar) await User.updateOne({ _id: user._id }, { $set: { avatar } });
    return user;
  } catch (err) {
    if (err.code === 11000) throw new OAuthLinkError('provider_in_use');
    throw err;
  }
}

export async function resolveOAuthUser({ provider, providerId, email, emailVerified, name, avatar, intent }) {
  const field = FIELD[provider];
  providerId = String(providerId);
  email = normalizeEmail(email);

  const owner = await User.findOne({ [field]: providerId });

  if (intent?.mode === 'link') {
    if (!intent.userId) throw new OAuthLinkError('link_requires_signin');
    if (owner && String(owner._id) !== String(intent.userId)) throw new OAuthLinkError('provider_in_use');
    if (owner) return { user: owner, linked: false };
    return { user: await linkIdentity(intent.userId, provider, providerId, avatar), linked: true };
  }

  if (owner) {
    if (owner.disabledAt) throw new OAuthLinkError('account_disabled');
    const set = {};
    if (!owner.avatar && avatar) set.avatar = avatar;
    if (emailVerified && email && owner.email === email && !owner.emailVerifiedAt) set.emailVerifiedAt = new Date();
    if (Object.keys(set).length) await User.updateOne({ _id: owner._id }, { $set: set });
    return { user: owner, linked: false };
  }

  if (!email || !emailVerified) throw new OAuthLinkError('email_unverified');

  const byEmail = await User.findOne({ email });
  if (byEmail) {
    if (byEmail.disabledAt) throw new OAuthLinkError('account_disabled');
    if (!byEmail.emailVerifiedAt) throw new OAuthLinkError('account_exists_unverified');
    return { user: await linkIdentity(byEmail._id, provider, providerId, avatar), linked: true };
  }

  try {
    const user = await User.create({
      [field]: providerId,
      name: cleanName(name, email),
      email,
      avatar,
      emailVerifiedAt: new Date(),
    });
    return { user, linked: false, created: true };
  } catch (err) {
    if (err.code !== 11000) throw err;
    // a concurrent or retried callback created it first — resolve to that row, never a duplicate
    const again = await User.findOne({ [field]: providerId });
    if (again) return { user: again, linked: false };
    const sameEmail = await User.findOne({ email });
    if (sameEmail?.emailVerifiedAt) return { user: await linkIdentity(sameEmail._id, provider, providerId, avatar), linked: true };
    throw new OAuthLinkError('account_exists_unverified');
  }
}

const backendUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5055}`;

const verifyWith = (provider, extract) => async (req, _accessToken, _refreshToken, profile, done) => {
  try {
    const result = await resolveOAuthUser({ provider, ...extract(profile), intent: req.oauthIntent });
    req.oauthResult = result;
    return done(null, result.user);
  } catch (err) {
    if (err instanceof OAuthLinkError) return done(null, false, { message: err.code });
    return done(err, null);
  }
};

export const configuredProviders = { google: false, github: false };

// 1. Google — the userinfo profile is fetched server-side with the access token
// from the code exchange; `email_verified` comes from Google.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const googleCallback = process.env.GOOGLE_CALLBACK_URL || `${backendUrl()}/api/auth/google/callback`;
  console.log('[Auth] Initializing Google Strategy with callback:', googleCallback);

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: googleCallback,
    proxy: true,
    passReqToCallback: true,
    pkce: true,
    store: new OAuthStateStore(),
  }, verifyWith('google', (profile) => ({
    providerId: profile.id,
    email: profile.emails?.[0]?.value,
    emailVerified: profile._json?.email_verified === true || profile._json?.email_verified === 'true',
    name: profile.displayName,
    avatar: profile.photos?.[0]?.value,
  }))));
  configuredProviders.google = true;
} else {
  console.warn('⚠️ Google Client ID/Secret missing. Google Login disabled.');
}

// 2. GitHub — `allRawEmails` returns /user/emails with GitHub's own
// primary/verified flags; only a verified address is ever used.
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || `${backendUrl()}/api/auth/github/callback`,
    scope: ['user:email'],
    allRawEmails: true,
    passReqToCallback: true,
    pkce: true,
    store: new OAuthStateStore(),
  }, verifyWith('github', (profile) => {
    const emails = Array.isArray(profile.emails) ? profile.emails : [];
    const chosen = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || null;
    return {
      providerId: profile.id,
      email: chosen?.value || null,
      emailVerified: !!chosen,
      name: profile.displayName || profile.username,
      avatar: profile.photos?.[0]?.value,
    };
  })));
  configuredProviders.github = true;
} else {
  console.warn('⚠️ GitHub Client ID/Secret missing. GitHub Login disabled.');
}


export default passport;
