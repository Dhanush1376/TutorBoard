const NAMES = { google: 'Google', github: 'GitHub' };

/** Plain-language text for the ?error= codes the OAuth callback redirects with. */
export function oauthErrorMessage(code, provider) {
  const name = NAMES[provider] || 'that provider';
  switch (code) {
    case 'email_unverified':
      return `${name} did not share a verified email address, so we can't sign you in with it. Verify your email with ${name}, or sign in another way.`;
    case 'account_exists_unverified':
      return `An account with this email already exists. Sign in with your password (or reset it), then connect ${name} from Settings → Account.`;
    case 'provider_in_use':
      return `That ${name} account is already connected to a different TutorBoard account.`;
    case 'provider_already_linked':
      return `Your account is already connected to a different ${name} account. Disconnect it first.`;
    case 'account_disabled':
      return 'This account has been disabled. Contact support if you think this is a mistake.';
    case 'provider_disabled':
      return 'That sign-in method is turned off right now. Use another way to sign in.';
    case 'state_mismatch':
    case 'expired_state':
    case 'missing_state':
      return 'The sign-in took too long or was started in another window. Please try again.';
    case 'link_requires_signin':
      return 'Sign in first, then connect the account from Settings.';
    case 'google_failed':
    case 'github_failed':
    case 'auth_failed':
    case 'server_error':
    default:
      return 'Sign-in did not complete. Please try again.';
  }
}
