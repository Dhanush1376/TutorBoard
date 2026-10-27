import crypto from 'crypto';
import OAuthState from '../../models/OAuthState.js';

/**
 * passport-oauth2 state store (with PKCE): `state` + code verifier are kept
 * server-side, keyed by the hash of a random handle, and bound to the browser
 * that started the flow through an HttpOnly nonce cookie. The callback must
 * present both the handle (from the provider redirect) and the matching cookie,
 * so an attacker cannot complete their own authorization in a victim's browser
 * (login CSRF), and each state works once.
 */

const COOKIE = 'tb-oauth-binding';
const TTL_MS = 10 * 60 * 1000;
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

const cookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // the provider redirects back with a top-level GET, which carries Lax cookies
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: TTL_MS,
});

export class OAuthStateStore {
  // arity 5 → passport passes the PKCE verifier
  store(req, verifier, _state, _meta, cb) {
    (async () => {
      const handle = crypto.randomBytes(32).toString('base64url');
      let binding = req.cookies?.[COOKIE];
      if (typeof binding !== 'string' || binding.length < 32) {
        binding = crypto.randomBytes(32).toString('base64url');
        req.res?.cookie(COOKIE, binding, cookieOpts());
      }
      await OAuthState.create({
        handleHash: sha256(handle),
        bindingHash: sha256(binding),
        verifier,
        intent: req.oauthIntent || { mode: 'login', userId: null },
        expiresAt: new Date(Date.now() + TTL_MS),
      });
      return handle;
    })().then((h) => cb(null, h), cb);
  }

  verify(req, handle, _meta, cb) {
    (async () => {
      if (typeof handle !== 'string' || !handle) return { ok: false, info: { message: 'missing_state' } };
      const doc = await OAuthState.findOneAndDelete({ handleHash: sha256(handle) }).lean();
      if (!doc || doc.expiresAt <= new Date()) return { ok: false, info: { message: 'expired_state' } };
      const binding = req.cookies?.[COOKIE];
      if (!binding || sha256(binding) !== doc.bindingHash) return { ok: false, info: { message: 'state_mismatch' } };
      req.oauthIntent = doc.intent;
      return { ok: doc.verifier || true };
    })().then(({ ok, info }) => cb(null, ok, info), cb);
  }
}

export const OAUTH_BINDING_COOKIE = COOKIE;
