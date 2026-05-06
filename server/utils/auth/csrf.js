import crypto from 'crypto';

/**
 * Double Submit Cookie CSRF Utility
 * This implementation uses a stateless secret stored in an HTTP-only cookie
 * and a derived token that the client sends in a custom header.
 */

const CSRF_SECRET_LEN = 32;

/**
 * Generates a random secret for the CSRF cookie
 */
export const generateCsrfSecret = () => {
  return crypto.randomBytes(CSRF_SECRET_LEN).toString('hex');
};

/**
 * Derives a public token from the secret.
 * In a simple implementation, the secret itself can be used, 
 * but hashing it adds a layer of protection if the plain cookie is leaked.
 */
export const deriveCsrfToken = (secret) => {
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest('hex');
};

/**
 * Validates that the provided token matches the secret
 */
export const validateCsrf = (secret, token) => {
  if (!secret || !token) return false;
  const expectedToken = deriveCsrfToken(secret);
  
  // Constant time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedToken),
      Buffer.from(token)
    );
  } catch (e) {
    return false;
  }
};
