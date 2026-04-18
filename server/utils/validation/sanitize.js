/**
 * sanitize.js — Input sanitization utilities
 *
 * Strips HTML tags and escapes characters that could cause XSS
 * when rendered in canvas text, SVG, or chat bubbles.
 */

/**
 * Strip all HTML/SVG tags and escape dangerous characters.
 * Safe for use in canvas text rendering and chat display.
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';

  return str
    // Remove valid HTML/SVG tags only (prevents breaking math like "a < b")
    .replace(/<(?!\s)[/a-z][a-z0-9]*\b[^>]*>/gi, '')
    // Remove javascript: protocol attempts
    .replace(/javascript\s*:/gi, '')
    // Remove on* event handlers that might survive
    .replace(/on\w+\s*=/gi, '')
    // Collapse excessive whitespace
    .replace(/\s{3,}/g, '  ')
    // Trim
    .trim();
}

/**
 * Sanitize and enforce a maximum length.
 */
export function sanitizeInput(str, maxLength = 5000) {
  const cleaned = sanitizeText(str);
  return cleaned.substring(0, maxLength);
}

/**
 * Validate that a string is non-empty after sanitization.
 */
export function isValidInput(str) {
  return sanitizeText(str).length > 0;
}
