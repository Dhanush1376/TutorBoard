/**
 * Quick diagnostic: Test Google Gemini via the custom API path
 * This simulates exactly what happens when a user's custom key is used.
 */
import 'dotenv/config';
import { createProviderClient, executeProviderRequest } from '../utils/ai/providerFactory.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY not found in .env');
  process.exit(1);
}

console.log('🔑 Testing with Gemini key:', GEMINI_KEY.substring(0, 10) + '...');
console.log('');

// Test 1: Simple text request (no JSON format)
async function testSimple() {
  console.log('─── TEST 1: Simple text request (no response_format) ───');
  const client = createProviderClient('google', GEMINI_KEY);
  try {
    const result = await executeProviderRequest(client, 'google', {
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer in one sentence.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
      temperature: 0.1,
      maxTokens: 100,
    });
    console.log('✅ Content:', result.content?.substring(0, 200));
    console.log('   Provider:', result.provider);
    console.log('   Finish:', result.finishReason);
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('');
  }
}

// Test 2: JSON format request (response_format: json_object)
async function testJsonFormat() {
  console.log('─── TEST 2: JSON format request (response_format: json_object) ───');
  const client = createProviderClient('google', GEMINI_KEY);
  try {
    const result = await executeProviderRequest(client, 'google', {
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: 'Return a JSON object with key "answer" containing the result.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
      temperature: 0.1,
      maxTokens: 100,
      response_format: { type: 'json_object' },
    });
    console.log('✅ Content:', result.content?.substring(0, 200));
    console.log('   Provider:', result.provider);
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('');
  }
}

// Test 3: JSON format WITHOUT response_format (using prompt instruction only)
async function testJsonNoFormat() {
  console.log('─── TEST 3: JSON via prompt only (no response_format param) ───');
  const client = createProviderClient('google', GEMINI_KEY);
  try {
    const result = await executeProviderRequest(client, 'google', {
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: 'Return a JSON object with key "answer" containing the result.\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just raw JSON.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
      temperature: 0.1,
      maxTokens: 100,
    });
    console.log('✅ Content:', result.content?.substring(0, 200));
    console.log('   Provider:', result.provider);
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('');
  }
}

await testSimple();
await testJsonFormat();
await testJsonNoFormat();

console.log('🏁 All tests complete.');
process.exit(0);
