
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log('Sending Gemini Flash test request...');
  
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \Bearer \\,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [{role: 'user', content: 'Say hello'}]
    })
  });
  
  const body = await res.text();
  console.log('STATUS:', res.status);
  console.log('RESPONSE:', body);
}
run();

