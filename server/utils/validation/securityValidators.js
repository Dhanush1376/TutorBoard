/**
 * Security Validators
 * 
 * Functions to validate user input against SSRF, XSS, and other injection attacks.
 */

/**
 * Validates an avatar URL to prevent SSRF and XSS.
 * 
 * Rules:
 * 1. Must be a valid URL.
 * 2. Must use https protocol.
 * 3. Must not be a local or internal IP address (RFC 1918, etc.).
 * 4. Must not use data: or javascript: protocols.
 * 
 * @param {string} url - The URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAvatarUrl(url) {
  if (!url) return { valid: true }; // Empty is okay (no avatar)

  if (typeof url !== 'string') {
    return { valid: false, error: 'Avatar URL must be a string' };
  }

  // Prevent length-based DoS or buffer issues
  if (url.length > 1024) {
    return { valid: false, error: 'Avatar URL is too long' };
  }

  try {
    const parsed = new URL(url);

    // 1. Protocol check
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Avatar URL must use https protocol' };
    }

    const host = parsed.hostname.toLowerCase();

    // 2. Reject internal/local IPs
    // IPv4 patterns for private/local networks
    const isInternalIpv4 = (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) || // 172.16.0.0 - 172.31.255.255
      host.startsWith('169.254.') // Link-local
    );

    // Reject [::1] and other common IPv6 local patterns
    const isInternalIpv6 = (
      host === '[::1]' ||
      host.startsWith('[fc') ||
      host.startsWith('[fd') ||
      host.startsWith('[fe80')
    );

    if (isInternalIpv4 || isInternalIpv6) {
      return { valid: false, error: 'Avatar URL cannot point to internal or local addresses' };
    }

    // 3. Optional: Allow only trusted domains (e.g. gravatar, github, google, etc.)
    // For now, we'll stick to the core security requirements.

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Invalid URL format' };
  }
}
