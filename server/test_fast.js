
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log('Testing OpenRouter connection...');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': \Bearer \\,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [{role: 'user', content: 'Ping'}],
        max_tokens: 10
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    console.log('Status:', res.status);
    console.dir(data, {depth: null});
  } catch(e) {
    console.log('Error:', e.message);
  }
}
test();
