import crypto from 'crypto';

/**
 * AES-256-GCM Encryption Utility
 * 
 * Used to encrypt user API keys before storing in MongoDB.
 * Keys are NEVER stored in plaintext.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('[Crypto] ⚠️ ENCRYPTION_KEY not set. Using dev fallback. NOT SAFE FOR PRODUCTION.');
    // Generate a deterministic dev key (32 bytes = 64 hex chars)
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
  }
  // Accept hex-encoded 32-byte key
  if (key.length === 64) return Buffer.from(key, 'hex');
  // Accept raw 32-char key
  if (key.length === 32) return Buffer.from(key, 'utf8');
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars or 32 raw chars)');
}

/**
 * Encrypt a plaintext string
 * @param {string} plainText - The text to encrypt (e.g., an API key)
 * @returns {{ encrypted: string, iv: string, tag: string }}
 */
export function encrypt(plainText) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt an encrypted string
 * @param {{ encrypted: string, iv: string, tag: string }} data
 * @returns {string} The decrypted plaintext
 */
export function decrypt(data) {
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, 'hex');
  const tag = Buffer.from(data.tag, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Mask an API key for safe display (e.g., "sk-proj-****abcd")
 * @param {string} key - The raw API key
 * @returns {string} Masked version
 */
export function maskApiKey(key) {
  if (!key || key.length < 8) return '****';
  const prefix = key.substring(0, Math.min(7, Math.floor(key.length * 0.2)));
  const suffix = key.substring(key.length - 4);
  return `${prefix}****${suffix}`;
}
