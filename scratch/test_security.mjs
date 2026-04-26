import { validateAvatarUrl } from '../server/utils/validation/securityValidators.js';

const testCases = [
  { url: 'https://example.com/avatar.png', expected: true },
  { url: 'http://example.com/avatar.png', expected: false }, // Should be https
  { url: 'https://127.0.0.1/avatar.png', expected: false }, // Internal IP
  { url: 'https://localhost/avatar.png', expected: false }, // Internal host
  { url: 'https://169.254.169.254/latest/meta-data/', expected: false }, // AWS metadata
  { url: 'javascript:alert(1)', expected: false }, // XSS
  { url: 'data:image/png;base64,xxxx', expected: false }, // Data URI (not https)
  { url: 'https://192.168.1.1/router', expected: false }, // Private IP
  { url: 'https://10.0.0.1/admin', expected: false }, // Private IP
  { url: 'invalid-url', expected: false }, // Invalid format
  { url: '', expected: true }, // Empty is fine
  { url: null, expected: true }, // Null is fine
];

console.log('--- Testing validateAvatarUrl ---');
let passed = 0;
for (const tc of testCases) {
  const result = validateAvatarUrl(tc.url);
  const isOk = result.valid === tc.expected;
  console.log(`${isOk ? '✅' : '❌'} URL: ${tc.url} | Valid: ${result.valid} | Expected: ${tc.expected}${result.error ? ` | Error: ${result.error}` : ''}`);
  if (isOk) passed++;
}

console.log(`\nResult: ${passed}/${testCases.length} tests passed.`);

if (passed !== testCases.length) {
  process.exit(1);
}
