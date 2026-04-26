
import { sanitizeText } from '../server/utils/sanitize.js';

const testStrings = [
  'a < b',
  'x > 10',
  '<div>hello</div>',
  '<script>alert(1)</script>',
  'a < b and c > d',
  'H2O < CO2',
  'a<b' // This might still be stripped depending on regex, let's see
];

testStrings.forEach(s => {
  console.log(`Original: "${s}" -> Sanitized: "${sanitizeText(s)}"`);
});
