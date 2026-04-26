/**
 * Raw HTTP diagnostic: See EXACTLY what Google Gemini returns.
 * No OpenAI SDK - pure fetch to eliminate any SDK-level issues.
 */
import 'dotenv/config';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
console.log('Key:', GEMINI_KEY?.substring(0, 12) + '...');

// Test 1: Direct Google OpenAI-compatible endpoint
const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const body = {
  model: 'gemini-2.0-flash',
  messages: [
    { role: 'user', content: 'Say hello in one word.' }
  ],
  temperature: 0.1,
  max_tokens: 50,
};

console.log('\n─── RAW FETCH to Google OpenAI endpoint ───');
console.log('URL:', url);
console.log('Body:', JSON.stringify(body, null, 2));

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GEMINI_KEY}`,
    },
    body: JSON.stringify(body),
  });

  console.log('\nHTTP Status:', res.status, res.statusText);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));

  const text = await res.text();
  console.log('\nRaw response body (first 1000 chars):');
  console.log(text.substring(0, 1000));
  
  if (res.ok) {
    const data = JSON.parse(text);
    console.log('\nParsed:');
    console.log('  choices count:', data.choices?.length);
    console.log('  choice[0].message:', JSON.stringify(data.choices?.[0]?.message));
    console.log('  finish_reason:', data.choices?.[0]?.finish_reason);
    console.log('  usage:', JSON.stringify(data.usage));
  }
} catch (err) {
  console.error('Fetch error:', err.message);
}

process.exit(0);
