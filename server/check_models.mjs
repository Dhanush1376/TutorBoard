
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': \Bearer \\ }
  });
  const data = await res.json();
  const models = data.data.map(m => m.id).filter(id => id.includes('gemini'));
  console.log('Gemini Models available:', models);
}
run();
